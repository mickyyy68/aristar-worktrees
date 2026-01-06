/**
 * OpenCode API Types
 *
 * Consolidated types for the OpenCode SSE API based on official documentation.
 * This file contains all types for SSE events, message parts, and session management.
 *
 * ## SSE Event Structure
 *
 * All events have the format: { type: string, properties: object }
 *
 * ### message.updated
 * Sent when a message is created or updated.
 * ```json
 * {
 *   "type": "message.updated",
 *   "properties": {
 *     "sessionID": "ses_xxx",
 *     "info": {
 *       "id": "msg_xxx",
 *       "role": "user" | "assistant" | "system",
 *       "time": { "created": "2024-01-01T00:00:00Z" }
 *     }
 *   }
 * }
 * ```
 *
 * ### message.part.updated
 * Sent for streaming content (text, tool, reasoning).
 * Note: sessionID and messageID are INSIDE the part object.
 * ```json
 * {
 *   "type": "message.part.updated",
 *   "properties": {
 *     "part": {
 *       "id": "prt_xxx",
 *       "sessionID": "ses_xxx",
 *       "messageID": "msg_xxx",
 *       "type": "text" | "tool" | "reasoning" | "step-finish",
 *       "text": "...",  // for text/reasoning
 *       "tool": "...",  // for tool (tool name)
 *       "callID": "...", // for tool
 *       "state": { "status": "pending"|"running"|"completed"|"error", "input": {}, "output": {} },
 *       "time": { "start": 1234567890, "end": 1234567890 }
 *     },
 *     "delta": "..."  // incremental text for streaming
 *   }
 * }
 * ```
 *
 * ### session.status
 * Sent when session state changes.
 * ```json
 * {
 *   "type": "session.status",
 *   "properties": {
 *     "sessionID": "ses_xxx",
 *     "status": { "type": "idle" | "busy" | "pending" } | "idle" | "busy"
 *   }
 * }
 * ```
 *
 * ### session.idle
 * Sent when session finishes processing.
 * ```json
 * {
 *   "type": "session.idle",
 *   "properties": { "sessionID": "ses_xxx" }
 * }
 * ```
 *
 * ### step-finish part
 * Special part type indicating a step completed.
 * ```json
 * {
 *   "type": "step-finish",
 *   "reason": "stop",
 *   "snapshot": "abc123",
 *   "cost": 0.001,
 *   "tokens": { "input": 100, "output": 50, "reasoning": 0, "cache": { "read": 0, "write": 0 } }
 * }
 * ```
 */

// ============ SSE Event Types ============

/**
 * Base SSE event type
 */
export interface SSEEvent {
  type: string;
  properties?: Record<string, unknown>;
}

/**
 * Server connected event - sent when SSE connection is established
 */
export interface ServerConnectedEvent extends SSEEvent {
  type: 'server.connected';
}

/**
 * Heartbeat event - sent periodically to keep connection alive
 */
export interface HeartbeatEvent extends SSEEvent {
  type: 'heartbeat';
}

/**
 * Message updated event - contains message info for create/update
 */
export interface MessageUpdatedEvent extends SSEEvent {
  type: 'message.updated';
  properties: {
    sessionID: string;
    info: {
      id: string;
      role: 'user' | 'assistant' | 'system';
      time?: { created: string };
    };
  };
}

/**
 * Message part updated event - contains part delta for streaming
 * Note: sessionID and messageID are inside the part object, not at top level
 */
export interface MessagePartUpdatedEvent extends SSEEvent {
  type: 'message.part.updated';
  properties: {
    part: APIPart & {
      sessionID: string;
      messageID: string;
    };
    delta?: string; // For text parts, the incremental content
  };
}

/**
 * Session status event - indicates session state changes
 */
export interface SessionStatusEvent extends SSEEvent {
  type: 'session.status';
  properties: {
    sessionID: string;
    status: { type: 'idle' | 'busy' | 'pending' } | string;
  };
}

/**
 * Session idle event - session has finished processing
 */
export interface SessionIdleEvent extends SSEEvent {
  type: 'session.idle';
  properties: {
    sessionID: string;
  };
}

// ============ Session Diff Types ============

/**
 * Single file diff entry from session.diff event
 */
export interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
}

/**
 * Session diff event - sent when files are modified
 */
export interface SessionDiffEvent extends SSEEvent {
  type: 'session.diff';
  properties: {
    sessionID: string;
    diff: FileDiff[];
  };
}

/**
 * Union of all known SSE event types
 */
export type OpenCodeSSEEvent =
  | ServerConnectedEvent
  | HeartbeatEvent
  | MessageUpdatedEvent
  | MessagePartUpdatedEvent
  | SessionStatusEvent
  | SessionIdleEvent
  | SessionDiffEvent
  | SSEEvent; // Fallback for unknown events

// ============ Message Part Types (API format) ============

/**
 * Text part from OpenCode API
 */
export interface APITextPart {
  type: 'text';
  text: string;
  messageID?: string;
}

/**
 * Tool part from OpenCode API
 */
export interface APIToolPart {
  type: 'tool';
  tool: string;
  callID: string;
  messageID?: string;
  state?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: unknown;
    output?: unknown;
  };
}

/**
 * Reasoning part from OpenCode API (internal thinking)
 */
export interface APIReasoningPart {
  type: 'reasoning';
  text: string;
  messageID?: string;
}

/**
 * Union of API part types
 */
export type APIPart = APITextPart | APIToolPart | APIReasoningPart;

// ============ Internal Message Types ============

/**
 * Text part for internal storage
 */
export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * Tool invocation part for internal storage
 * Normalized from API format with consistent naming
 */
export interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocationId: string;
  toolName: string;
  state: 'pending' | 'running' | 'completed' | 'error' | 'result';
  args?: unknown;
  result?: unknown;
}

/**
 * Reasoning part for internal storage
 */
export interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

/**
 * Union of internal message part types
 */
export type MessagePart = TextPart | ToolInvocationPart | ReasoningPart;

/**
 * Message structure for internal storage
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts: MessagePart[];
  timestamp: Date;
  isStreaming?: boolean;
}

/**
 * Streaming message (extends Message with streaming flag)
 */
export interface StreamingMessage extends Message {
  isStreaming: true;
}

// ============ Session Types ============

/**
 * Session info from OpenCode API
 */
export interface OpenCodeSession {
  id: string;
  title?: string;
  created: Date;
  updated: Date;
}

// ============ Helper Functions ============

/**
 * Extract sessionID from any SSE event
 */
export function extractSessionId(event: SSEEvent): string | null {
  // Handle session.diff events which use 'data' instead of 'properties'
  const eventWithData = event as { data?: { sessionID?: string } };
  if (eventWithData.data?.sessionID) {
    return eventWithData.data.sessionID;
  }

  const props = event.properties as Record<string, unknown> | undefined;
  if (!props) return null;

  // sessionID location varies by event type:
  // - Top level: props.sessionID (session.status, session.idle, message.updated)
  // - In part: props.part.sessionID (message.part.updated)
  // - In info: props.info.sessionID (some message events)
  return (
    (props.sessionID as string) ||
    ((props.part as Record<string, unknown>)?.sessionID as string) ||
    ((props.info as Record<string, unknown>)?.sessionID as string) ||
    null
  );
}

/**
 * Convert an API part to internal MessagePart format
 */
export function convertAPIPart(part: APIPart): MessagePart {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.text };
    case 'tool':
      return {
        type: 'tool-invocation',
        toolInvocationId: part.callID,
        toolName: part.tool,
        state: part.state?.status || 'pending',
        args: part.state?.input,
        result: part.state?.output,
      };
    case 'reasoning':
      return { type: 'reasoning', text: part.text };
    default:
      // Unknown part type - return as-is wrapped in a text part
      return { type: 'text', text: '' };
  }
}

/**
 * Extract text content from message parts
 */
export function extractTextContent(parts: MessagePart[]): string {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}
