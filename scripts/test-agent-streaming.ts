#!/usr/bin/env bun
/**
 * Agent Manager Streaming Test Script
 *
 * Tests SSE streaming from OpenCode with minimax/MiniMax-M2.1 model.
 * Outputs structured JSON events to stdout.
 *
 * Usage: bun run scripts/test-agent-streaming.ts
 */

const PORT = 5149;
const PROMPT = "Hi, read the root readme.md";
const MODEL = "MiniMax-M2.1";
const MODEL_PROVIDER = "minimax";
const TIMEOUT_MS = 60000;

const BASE_URL = `http://127.0.0.1:${PORT}`;

interface SSEEvent {
  type: string;
  timestamp?: string;
  properties?: Record<string, unknown>;
}

interface StructuredEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function logEvent(event: StructuredEvent): void {
  console.log(JSON.stringify(event, null, 2));
}

async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/global/health`);
    if (!response.ok) return false;
    const data = await response.json();
    console.log(JSON.stringify({
      type: "health_check",
      timestamp: new Date().toISOString(),
      data: { healthy: data.healthy, version: data.version }
    }, null, 2));
    return data.healthy === true;
  } catch {
    return false;
  }
}

async function createSession(): Promise<string> {
  const response = await fetch(`${BASE_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Streaming Test" }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }

  const data = await response.json();
  console.log(JSON.stringify({
    type: "session_created",
    timestamp: new Date().toISOString(),
    data: { sessionId: data.id, title: data.title }
  }, null, 2));

  return data.id;
}

async function sendPromptAsync(
  sessionId: string,
  prompt: string,
  providerId: string,
  modelId: string
): Promise<void> {
  const response = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parts: [{ type: "text", text: prompt }],
      model: { providerID: providerId, modelID: modelId },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send prompt: ${response.statusText} - ${errorText}`);
  }

  console.log(JSON.stringify({
    type: "prompt_sent",
    timestamp: new Date().toISOString(),
    data: { sessionId, prompt, model: `${providerId}/${modelId}` }
  }, null, 2));
}

function parseEventData(eventData: string): SSEEvent | null {
  try {
    return JSON.parse(eventData);
  } catch {
    return null;
  }
}

async function streamEvents(sessionId: string, onComplete: () => void): Promise<void> {
  let completed = false;
  let messageContent = "";
  let abortController: AbortController | null = null;

  const cleanup = () => {
    if (!completed) {
      completed = true;
      if (abortController) {
        abortController.abort();
      }
      onComplete();
    }
  };

  logEvent({
    type: "sse_connecting",
    timestamp: new Date().toISOString(),
    data: { url: `${BASE_URL}/event` }
  });

  abortController = new AbortController();

  try {
    const response = await fetch(`${BASE_URL}/event`, {
      signal: abortController.signal,
      headers: { Accept: "text/event-stream" }
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.statusText}`);
    }

    logEvent({
      type: "sse_connected",
      timestamp: new Date().toISOString(),
      data: { url: `${BASE_URL}/event` }
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (!completed) {
      const { done, value } = await reader.read();
      if (done) {
        logEvent({
          type: "sse_closed",
          timestamp: new Date().toISOString(),
          data: { reason: "stream_ended" }
        });
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const eventData = line.slice(6);
          const sse = parseEventData(eventData);
          if (!sse) continue;

          const outputEvent: StructuredEvent = {
            type: sse.type,
            timestamp: new Date().toISOString(),
            data: {}
          };

          switch (sse.type) {
            case "server.connected":
              outputEvent.data = { message: "SSE connection established" };
              logEvent(outputEvent);
              break;

            case "message.updated": {
              const info = sse.properties?.info as { id: string; role: string; created?: string } | undefined;
              if (info && info.role === "assistant") {
                messageContent = "";
                outputEvent.data = {
                  sessionID: sessionId,
                  messageID: info.id,
                  role: info.role,
                  event: "message_created"
                };
                logEvent(outputEvent);
              }
              break;
            }

            case "message.part.updated": {
              const part = sse.properties?.part as Record<string, unknown> | undefined;
              const delta = sse.properties?.delta as string | undefined;

              if (part) {
                const partData: Record<string, unknown> = { type: part.type };
                if (part.text) partData.text = part.text;
                if (part.tool) partData.tool = part.tool;
                if (part.callID) partData.callID = part.callID;
                if (part.state) partData.state = part.state;

                outputEvent.data = {
                  sessionID: sessionId,
                  messageID: part.messageID,
                  part: partData,
                  ...(delta && { delta })
                };

                if (part.type === "text" && delta) {
                  messageContent += delta;
                  outputEvent.data.accumulatedContent = messageContent;
                }

                if (part.type === "tool") {
                  const state = (part.state as Record<string, unknown>)?.status;
                  const input = (part.state as Record<string, unknown>)?.input;
                  const output = (part.state as Record<string, unknown>)?.output;

                  console.log(JSON.stringify({
                    type: "tool_invocation",
                    timestamp: new Date().toISOString(),
                    data: {
                      sessionID: sessionId,
                      tool: part.tool,
                      callID: part.callID,
                      state,
                      input,
                      ...(output !== undefined && { output })
                    }
                  }, null, 2));
                } else {
                  logEvent(outputEvent);
                }
              }
              break;
            }

            case "session.status": {
              const status = sse.properties?.status;
              outputEvent.data = { sessionID: sessionId, status };
              logEvent(outputEvent);

              if (typeof status === "object" && status !== null && (status as Record<string, unknown>).type === "idle") {
                cleanup();
              } else if (typeof status === "string" && status === "idle") {
                cleanup();
              }
              break;
            }

            case "session.idle":
              outputEvent.data = { sessionID: sessionId, event: "session_complete" };
              logEvent(outputEvent);
              cleanup();
              break;

            default:
              outputEvent.data = sse.properties || {};
              logEvent(outputEvent);
          }
        }
      }
    }
  } catch (error) {
    if (!completed) {
      console.error(JSON.stringify({
        type: "sse_error",
        timestamp: new Date().toISOString(),
        data: { error: String(error) }
      }, null, 2));
    }
  }

  cleanup();
}

async function main(): Promise<void> {
  console.log(JSON.stringify({
    type: "test_started",
    timestamp: new Date().toISOString(),
    data: {
      port: PORT,
      prompt: PROMPT,
      model: `${MODEL_PROVIDER}/${MODEL}`,
      timeoutMs: TIMEOUT_MS
    }
  }, null, 2));

  console.log("\n--- Connecting to OpenCode server ---\n");

  if (!await healthCheck()) {
    console.error(JSON.stringify({
      type: "error",
      timestamp: new Date().toISOString(),
      data: { message: `OpenCode server not available at ${BASE_URL}` }
    }, null, 2));
    process.exit(1);
  }

  console.log("\n--- Creating session ---\n");
  const sessionId = await createSession();

  console.log("\n--- Starting event stream ---\n");

  const eventPromise = streamEvents(sessionId, () => {
    console.log("\n--- Stream complete ---\n");
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log("\n--- Sending prompt ---\n");
  await sendPromptAsync(sessionId, PROMPT, MODEL_PROVIDER, MODEL);

  await eventPromise;

  console.log("\n--- Test complete ---\n");
}

main().catch((error) => {
  console.error(JSON.stringify({
    type: "error",
    timestamp: new Date().toISOString(),
    data: { message: error.message, stack: error.stack }
  }, null, 2));
  process.exit(1);
});
