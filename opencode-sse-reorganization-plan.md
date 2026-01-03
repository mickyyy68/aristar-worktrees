# OpenCode SSE/Multi-Agent Reorganization Plan

## Executive Summary

This document outlines a complete rewrite of the OpenCode session management, SSE event handling, and multi-agent parallel execution system. The current implementation has fundamental architectural issues causing race conditions, state inconsistencies, and rendering bugs.

---

## Current Issues Analysis

### Issue 1: Loading Bubble Only Appears on First Agent

**Root Cause:** The `isLoading` state is stored per-agent in `agentLoading[agentKey]`, but the `useAgentSSE` hook has a single `streamingMessageRef` that gets confused when switching between agents. When Agent 2 starts processing, the loading state for Agent 1's SSE handler may still be active but no events come for it.

**Evidence:**
- `streamingMessageRef` in `use-agent-sse.ts` is a single ref that doesn't properly reset when switching agents
- The `handleEvent` callback captures `agentKey` in closure but the ref is shared

### Issue 2: Crash When Switching Agents After Tool Use

**Root Cause:** When switching from Agent 2 back to Agent 1, the SSE event handler tries to update messages for the wrong agent. The `streamingMessageRef` may still point to Agent 2's message but the `agentKey` is now Agent 1's key.

**Evidence:**
- The `useAgentSSE` hook uses `useCallback` with dependencies but the refs are mutable and not properly cleaned up
- When `message.part.updated` events arrive, they may be applied to the wrong message

### Issue 3: Tools Disappear on Refresh

**Root Cause:** Tools are stored in `message.parts` during streaming, but when messages are recovered from the API, the parts are not properly preserved/converted. The `extendedToStandardMessages` function in the store only extracts text content, losing tool parts.

**Evidence:**
```typescript
// In agent-manager-store.ts
function extendedToStandardMessages(messages: OpenCodeMessageExtended[]): OpenCodeMessage[] {
  // Only extracts TEXT content, loses parts!
  return messages.map((msg) => ({
    ...
    content: extractContentFromParts(msg.parts || []),  // Loses tool parts
  }));
}
```

### Issue 4: Race Condition Between SSE Subscription and Prompt

**Previously Fixed:** We added `establishSSEConnection` to wait for `server.connected` before sending prompts. However, this fix is incomplete because:
- The event handler registration still depends on React's render cycle
- Multiple agents starting simultaneously can still have overlapping handlers

---

## Architecture Problems

### Problem 1: Shared Singleton State

The current architecture uses:
- `opencodeClient` - A singleton shared across all operations
- `opencodeClientManager` - Manages clients per-agent but has complex state

**Issue:** When operations for different agents interleave, the singleton's `currentSessionId` gets overwritten.

### Problem 2: React Hook Timing Dependency

The SSE subscription is managed in a React hook (`useAgentSSE`), which means:
- Subscription only happens after render
- State updates trigger re-renders which can cause re-subscriptions
- The hook's cleanup may miss events

### Problem 3: Message Parts Not Persisted

Messages are stored with `content` (string) but parts are only in memory during streaming:
- After refresh, parts are lost
- Tool calls become invisible
- Recovery only fetches text content

### Problem 4: Global SSE Stream with Client-Side Filtering

OpenCode's `/event` endpoint broadcasts ALL events for ALL sessions. We filter by sessionId client-side, but:
- Multiple SSE connections to the same server are wasteful
- Race conditions when multiple agents share a server (shouldn't happen, but edge cases exist)

---

## Proposed New Architecture

### Core Principles

1. **One SSE Connection Per OpenCode Server** - Not per agent
2. **Message Store as Source of Truth** - Parts included, not just content
3. **Event Dispatcher Pattern** - Centralized event handling, not React hooks
4. **Imperative SSE Management** - Not dependent on React lifecycle

### New File Structure

```
src/modules/agent-manager/
├── api/
│   ├── opencode-client.ts      # HTTP client (no state)
│   ├── opencode-events.ts      # SSE event dispatcher (NEW)
│   ├── opencode-types.ts       # All OpenCode API types (NEW)
│   └── index.ts
├── store/
│   ├── types.ts                # Consolidated types
│   ├── agent-manager-store.ts  # Zustand store (simplified)
│   ├── message-store.ts        # Message/Part storage (NEW)
│   └── sse-manager.ts          # SSE connection manager (NEW)
├── hooks/
│   ├── use-agent-messages.ts   # Read-only hook for messages (NEW)
│   ├── use-agent-status.ts     # Read-only hook for status (NEW)
│   └── index.ts
└── components/
    └── ... (unchanged)
```

---

## Detailed Implementation Plan

### Phase 1: Create New Event Dispatcher System

#### 1.1 Create `opencode-types.ts`

Consolidate all OpenCode API types based on official documentation:

```typescript
// SSE Event Types (from /event endpoint)
interface ServerConnectedEvent {
  type: 'server.connected';
}

interface MessageUpdatedEvent {
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

interface MessagePartUpdatedEvent {
  type: 'message.part.updated';
  properties: {
    sessionID: string;
    messageID: string;
    part: Part;
    delta?: string; // For text parts, the incremental content
  };
}

interface SessionStatusEvent {
  type: 'session.status';
  properties: {
    sessionID: string;
    status: { type: 'idle' | 'busy' | 'pending' } | string;
  };
}

// Part Types (from OpenCode API)
interface TextPart {
  type: 'text';
  text: string;
}

interface ToolPart {
  type: 'tool';
  tool: string;
  callID: string;
  state?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: unknown;
    output?: unknown;
  };
}

interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

type Part = TextPart | ToolPart | ReasoningPart;
```

#### 1.2 Create `sse-manager.ts`

Manages SSE connections per port (not per agent):

```typescript
class SSEManager {
  private connections = new Map<number, {
    eventSource: EventSource;
    handlers: Map<string, Set<(event: SSEEvent) => void>>; // sessionId -> handlers
  }>();

  /**
   * Connect to an OpenCode server and return when connected
   */
  async connect(port: number): Promise<void> {
    if (this.connections.has(port)) return;
    
    return new Promise((resolve, reject) => {
      const url = `http://127.0.0.1:${port}/event`;
      const eventSource = new EventSource(url);
      
      const connection = {
        eventSource,
        handlers: new Map<string, Set<(event: SSEEvent) => void>>(),
      };
      
      eventSource.onmessage = (e) => {
        const event = JSON.parse(e.data);
        
        if (event.type === 'server.connected') {
          this.connections.set(port, connection);
          resolve();
          return;
        }
        
        // Dispatch to registered handlers
        this.dispatchEvent(port, event);
      };
      
      eventSource.onerror = (err) => {
        if (!this.connections.has(port)) {
          reject(new Error('SSE connection failed'));
        }
      };
    });
  }

  /**
   * Register a handler for a specific session's events
   */
  subscribe(
    port: number,
    sessionId: string,
    handler: (event: SSEEvent) => void
  ): () => void {
    const connection = this.connections.get(port);
    if (!connection) {
      throw new Error(`No connection on port ${port}`);
    }
    
    if (!connection.handlers.has(sessionId)) {
      connection.handlers.set(sessionId, new Set());
    }
    connection.handlers.get(sessionId)!.add(handler);
    
    return () => {
      connection.handlers.get(sessionId)?.delete(handler);
    };
  }

  private dispatchEvent(port: number, event: SSEEvent): void {
    const connection = this.connections.get(port);
    if (!connection) return;
    
    // Extract sessionId from event
    const sessionId = this.extractSessionId(event);
    
    // Dispatch to all handlers for this session
    if (sessionId) {
      const handlers = connection.handlers.get(sessionId);
      handlers?.forEach(h => h(event));
    }
    
    // Also dispatch to wildcard handlers (for debugging)
    const wildcardHandlers = connection.handlers.get('*');
    wildcardHandlers?.forEach(h => h(event));
  }
  
  private extractSessionId(event: SSEEvent): string | null {
    const props = event.properties;
    return props?.sessionID || 
           props?.info?.sessionID || 
           props?.part?.sessionID ||
           null;
  }

  disconnect(port: number): void {
    const connection = this.connections.get(port);
    if (connection) {
      connection.eventSource.close();
      this.connections.delete(port);
    }
  }
}

export const sseManager = new SSEManager();
```

#### 1.3 Create `message-store.ts`

Dedicated store for messages with full parts support:

```typescript
interface MessageState {
  // Full messages with parts preserved
  messages: Map<string, Message[]>; // agentKey -> messages
  
  // Streaming state
  streamingMessages: Map<string, StreamingMessage>; // agentKey -> current streaming msg
  
  // Loading indicators
  loading: Map<string, boolean>; // agentKey -> isLoading
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts: Part[];
  timestamp: Date;
}

interface StreamingMessage extends Message {
  isStreaming: true;
}

// Actions
interface MessageActions {
  // Called when message.updated event arrives
  startMessage(agentKey: string, messageId: string, role: string): void;
  
  // Called when message.part.updated event arrives
  updatePart(agentKey: string, messageId: string, part: Part, delta?: string): void;
  
  // Called when session.status becomes idle
  completeMessage(agentKey: string): void;
  
  // Add local user message (before sending to API)
  addUserMessage(agentKey: string, content: string): void;
  
  // Load messages from API (recovery)
  loadMessages(agentKey: string, messages: Message[]): void;
  
  // Clear messages for an agent
  clearMessages(agentKey: string): void;
  
  // Set loading state
  setLoading(agentKey: string, loading: boolean): void;
}

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  messages: new Map(),
  streamingMessages: new Map(),
  loading: new Map(),
  
  startMessage(agentKey, messageId, role) {
    set((state) => {
      const streaming = new Map(state.streamingMessages);
      streaming.set(agentKey, {
        id: messageId,
        role: role as 'assistant',
        content: '',
        parts: [],
        timestamp: new Date(),
        isStreaming: true,
      });
      return { 
        streamingMessages: streaming,
        loading: new Map(state.loading).set(agentKey, true),
      };
    });
  },
  
  updatePart(agentKey, messageId, part, delta) {
    set((state) => {
      const streaming = state.streamingMessages.get(agentKey);
      if (!streaming || streaming.id !== messageId) return state;
      
      const updated = { ...streaming };
      
      if (part.type === 'text' && delta) {
        // Accumulate text delta
        updated.content += delta;
      } else if (part.type === 'tool') {
        // Update or add tool part
        const existingIdx = updated.parts.findIndex(
          p => p.type === 'tool' && p.callID === part.callID
        );
        if (existingIdx >= 0) {
          updated.parts[existingIdx] = part;
        } else {
          updated.parts.push(part);
        }
      }
      
      const newStreaming = new Map(state.streamingMessages);
      newStreaming.set(agentKey, updated);
      return { streamingMessages: newStreaming };
    });
  },
  
  completeMessage(agentKey) {
    set((state) => {
      const streaming = state.streamingMessages.get(agentKey);
      if (!streaming) return state;
      
      // Move from streaming to completed
      const messages = new Map(state.messages);
      const agentMessages = [...(messages.get(agentKey) || [])];
      
      const completedMessage: Message = {
        ...streaming,
        isStreaming: undefined, // Remove streaming flag
      };
      agentMessages.push(completedMessage);
      messages.set(agentKey, agentMessages);
      
      const newStreaming = new Map(state.streamingMessages);
      newStreaming.delete(agentKey);
      
      const loading = new Map(state.loading);
      loading.set(agentKey, false);
      
      return { 
        messages, 
        streamingMessages: newStreaming,
        loading,
      };
    });
  },
  
  // ... other actions
}));
```

### Phase 2: Refactor Agent Execution Flow

#### 2.1 New `startAgent` Flow

```typescript
async startAgent(taskId: string, agentId: string, prompt: string) {
  const agentKey = getAgentKey(taskId, agentId);
  
  // 1. Start OpenCode server (Rust backend)
  const port = await commands.startAgentOpencode(taskId, agentId);
  
  // 2. Wait for server health
  await waitForServerReady(port);
  
  // 3. Establish SSE connection (global for this port)
  await sseManager.connect(port);
  
  // 4. Create session
  const session = await createSession(port, title);
  
  // 5. Register SSE handler for this session BEFORE sending prompt
  const unsubscribe = sseManager.subscribe(port, session.id, (event) => {
    this.handleAgentEvent(agentKey, event);
  });
  
  // 6. Update store with port/session
  set({ ... });
  
  // 7. Add user message locally
  useMessageStore.getState().addUserMessage(agentKey, prompt);
  
  // 8. Send prompt (async, no wait for response)
  await sendPromptAsync(port, session.id, prompt, options);
  
  // Store unsubscribe for cleanup
  this.eventUnsubscribers.set(agentKey, unsubscribe);
}
```

#### 2.2 Centralized Event Handler

```typescript
handleAgentEvent(agentKey: string, event: SSEEvent) {
  const messageStore = useMessageStore.getState();
  
  switch (event.type) {
    case 'message.updated': {
      const info = event.properties.info;
      if (info.role === 'assistant') {
        messageStore.startMessage(agentKey, info.id, info.role);
      }
      break;
    }
    
    case 'message.part.updated': {
      const { messageID, part, delta } = event.properties;
      messageStore.updatePart(agentKey, messageID, part, delta);
      break;
    }
    
    case 'session.status': {
      const status = event.properties.status;
      const statusType = typeof status === 'object' ? status.type : status;
      if (statusType === 'idle') {
        messageStore.completeMessage(agentKey);
      }
      break;
    }
  }
}
```

### Phase 3: Simplify React Hooks

#### 3.1 Create `use-agent-messages.ts`

Read-only hook that doesn't manage subscriptions:

```typescript
export function useAgentMessages(taskId: string | null, agentId: string | null) {
  const agentKey = taskId && agentId ? getAgentKey(taskId, agentId) : null;
  
  const messages = useMessageStore((state) => 
    agentKey ? state.messages.get(agentKey) || [] : []
  );
  
  const streamingMessage = useMessageStore((state) =>
    agentKey ? state.streamingMessages.get(agentKey) : null
  );
  
  const isLoading = useMessageStore((state) =>
    agentKey ? state.loading.get(agentKey) || false : false
  );
  
  // Combine completed messages with streaming message
  const allMessages = useMemo(() => {
    const result = [...messages];
    if (streamingMessage) {
      result.push(streamingMessage);
    }
    return result;
  }, [messages, streamingMessage]);
  
  return { messages: allMessages, isLoading };
}
```

### Phase 4: Fix Message Recovery

#### 4.1 Update `recoverTaskAgents`

```typescript
async recoverTaskAgents(taskId: string) {
  for (const agent of task.agents) {
    if (!agent.sessionId) continue;
    
    const agentKey = getAgentKey(taskId, agent.id);
    
    // Start server if needed
    const port = await ensureServerRunning(taskId, agent.id);
    
    // Establish SSE connection
    await sseManager.connect(port);
    
    // Fetch messages WITH PARTS from API
    const response = await fetch(`http://127.0.0.1:${port}/session/${agent.sessionId}/message`);
    const rawMessages = await response.json();
    
    // Convert to our format, PRESERVING PARTS
    const messages: Message[] = rawMessages.map((m: any) => ({
      id: m.info.id,
      role: m.info.role,
      content: extractTextContent(m.parts),
      parts: convertParts(m.parts), // NEW: Preserve all parts
      timestamp: new Date(m.info.time?.created || Date.now()),
    }));
    
    useMessageStore.getState().loadMessages(agentKey, messages);
    
    // Register SSE handler for ongoing events
    sseManager.subscribe(port, agent.sessionId, (event) => {
      this.handleAgentEvent(agentKey, event);
    });
  }
}

function convertParts(apiParts: any[]): Part[] {
  return apiParts.map(p => {
    if (p.type === 'text') {
      return { type: 'text', text: p.text };
    }
    if (p.type === 'tool') {
      return {
        type: 'tool',
        tool: p.tool,
        callID: p.callID,
        state: p.state,
      };
    }
    // ... other part types
    return p;
  });
}
```

---

## Test Scripts

### Test 1: Single Agent Streaming

```typescript
// scripts/test-single-agent.ts
import { sseManager } from '../src/modules/agent-manager/store/sse-manager';

async function testSingleAgent() {
  const port = 5149;
  
  console.log('1. Connecting to SSE...');
  await sseManager.connect(port);
  console.log('   Connected!');
  
  console.log('2. Creating session...');
  const session = await createSession(port);
  console.log(`   Session: ${session.id}`);
  
  console.log('3. Registering event handler...');
  let messageContent = '';
  const toolCalls: any[] = [];
  
  sseManager.subscribe(port, session.id, (event) => {
    if (event.type === 'message.updated') {
      console.log(`   [EVENT] Message created: ${event.properties.info.id}`);
    }
    if (event.type === 'message.part.updated') {
      const { part, delta } = event.properties;
      if (part.type === 'text' && delta) {
        messageContent += delta;
        process.stdout.write(delta);
      }
      if (part.type === 'tool') {
        console.log(`   [EVENT] Tool: ${part.tool} (${part.state?.status})`);
        toolCalls.push(part);
      }
    }
    if (event.type === 'session.status') {
      console.log(`\n   [EVENT] Session status: ${JSON.stringify(event.properties.status)}`);
    }
  });
  
  console.log('4. Sending prompt...');
  await sendPromptAsync(port, session.id, 'List files in current directory');
  
  console.log('5. Waiting for completion...');
  // Wait for idle
  await new Promise(r => setTimeout(r, 30000));
  
  console.log('\n=== Final Results ===');
  console.log(`Content length: ${messageContent.length}`);
  console.log(`Tool calls: ${toolCalls.length}`);
  toolCalls.forEach(t => console.log(`  - ${t.tool}: ${t.state?.status}`));
}
```

### Test 2: Multi-Agent Parallel

```typescript
// scripts/test-multi-agent.ts
async function testMultiAgent() {
  const agents = [
    { id: 'agent-1', port: 5149, prompt: 'What is 2+2?' },
    { id: 'agent-2', port: 5150, prompt: 'What is 3+3?' },
  ];
  
  const results = new Map<string, { content: string; tools: any[] }>();
  
  // Setup all agents
  for (const agent of agents) {
    await sseManager.connect(agent.port);
    const session = await createSession(agent.port);
    
    results.set(agent.id, { content: '', tools: [] });
    
    sseManager.subscribe(agent.port, session.id, (event) => {
      const r = results.get(agent.id)!;
      
      if (event.type === 'message.part.updated') {
        const { part, delta } = event.properties;
        if (part.type === 'text' && delta) {
          r.content += delta;
        }
        if (part.type === 'tool') {
          r.tools.push(part);
        }
      }
      if (event.type === 'session.status' && 
          event.properties.status?.type === 'idle') {
        console.log(`[${agent.id}] Complete! Content: ${r.content.length} chars, ${r.tools.length} tools`);
      }
    });
    
    // Send prompt (don't await response)
    await sendPromptAsync(agent.port, session.id, agent.prompt);
  }
  
  // Wait for all to complete
  await new Promise(r => setTimeout(r, 60000));
  
  console.log('\n=== Results ===');
  for (const [id, r] of results) {
    console.log(`${id}: "${r.content.substring(0, 100)}..."`);
  }
}
```

### Test 3: Tool Persistence After Refresh

```typescript
// scripts/test-tool-persistence.ts
async function testToolPersistence() {
  const port = 5149;
  
  // Simulate: Agent runs tool, then we "refresh" (reconnect and fetch messages)
  
  console.log('1. Initial run with tools...');
  await sseManager.connect(port);
  const session = await createSession(port);
  
  let tools: any[] = [];
  sseManager.subscribe(port, session.id, (event) => {
    if (event.type === 'message.part.updated' && event.properties.part.type === 'tool') {
      tools.push(event.properties.part);
    }
  });
  
  await sendPromptAsync(port, session.id, 'Run ls command');
  await new Promise(r => setTimeout(r, 15000));
  
  console.log(`   Tools from streaming: ${tools.length}`);
  
  console.log('2. Simulating refresh - fetching from API...');
  const response = await fetch(`http://127.0.0.1:${port}/session/${session.id}/message`);
  const messages = await response.json();
  
  const recoveredTools: any[] = [];
  for (const msg of messages) {
    for (const part of msg.parts || []) {
      if (part.type === 'tool') {
        recoveredTools.push(part);
      }
    }
  }
  
  console.log(`   Tools from API: ${recoveredTools.length}`);
  console.log(`   Match: ${tools.length === recoveredTools.length ? 'YES' : 'NO'}`);
  
  // Show details
  recoveredTools.forEach((t, i) => {
    console.log(`   ${i+1}. ${t.tool} - ${t.state?.status}`);
  });
}
```

---

## Migration Steps

1. **Create new files** without removing old ones
2. **Add feature flag** to switch between implementations
3. **Test new implementation** with test scripts
4. **Update components** to use new hooks
5. **Remove old implementation** once stable

---

## Success Criteria

1. Loading indicator shows correctly for ALL agents
2. Switching between agents does not cause crashes
3. Tools persist after page refresh
4. Multiple agents can stream simultaneously without interference
5. SSE connection is established before any prompts are sent
6. Test scripts pass consistently

---

## Timeline Estimate

- Phase 1 (Event Dispatcher): 2-3 hours
- Phase 2 (Execution Flow): 2-3 hours  
- Phase 3 (React Hooks): 1-2 hours
- Phase 4 (Message Recovery): 1-2 hours
- Testing & Debugging: 2-4 hours

**Total: 8-14 hours**

---

## References

- [OpenCode Server API](https://opencode.ai/docs/server)
- [OpenCode SDK](https://opencode.ai/docs/sdk)
- SSE Events: `/event` endpoint returns `server.connected`, `message.updated`, `message.part.updated`, `session.status`
- Parts API: `/session/:id/message` returns messages with full `parts` array
