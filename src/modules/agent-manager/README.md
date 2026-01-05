# Agent Manager Module

> **TL;DR**: AI agent orchestration UI for running multiple AI models on the same task, with real-time streaming via SSE, chat interface, and tool call visualization.

## Overview

The `agent-manager` module provides the frontend for the AI agent orchestration system:

- **Task Management**: Create and manage tasks with multiple AI agents
- **OpenCode Integration**: Connect to OpenCode servers for each agent's worktree
- **Real-time Streaming**: SSE-based event streaming for live updates
- **Chat Interface**: Send prompts and view AI responses
- **Tool Visualization**: Display tool calls and their results

## UI Layout

The Agent Manager uses a centered, constrained-width layout for the chat area:

- **Collapsible Sidebar**: The task list sidebar can be collapsed/expanded using the toggle button. State is persisted in app settings.
- **Centered Chat**: Chat area is centered with `max-w-3xl` for better readability
- **Agent Tabs**: When multiple agents are configured, displays as larger cards showing model name and status
- **Integrated Actions**: Agent actions (terminal, editor, accept, stop) are integrated into the chat input toolbar

## Prerequisites

### OpenCode CLI

The agent manager requires the OpenCode CLI to be installed for running AI agents. The app looks for the binary at:

- `~/.opencode/bin/opencode` (standard installation location on macOS)
- Any directory in `PATH`

Download OpenCode from https://opencode.ai

## Composite Key Architecture

Agent state is keyed by a composite key: `{taskId}:{agentId}`. This is necessary because agent IDs (e.g., "agent-1") are only unique within a task context.

```typescript
import { getAgentKey } from '@agent-manager/store';

const key = getAgentKey('a1b2c3d4', 'agent-1');
// Result: "a1b2c3d4:agent-1"
```

All per-agent state uses this composite key:
- `agentMessages[key]` - chat history
- `agentLoading[key]` - loading state
- `agentOpencodePorts[key]` - OpenCode server port

## File Structure

```
agent-manager/
├── api/
│   ├── opencode.ts        # OpenCode HTTP client
│   ├── opencode-types.ts  # Consolidated type definitions for OpenCode API
│   ├── sse-manager.ts     # Centralized SSE connection manager
│   ├── use-agent-sse.ts   # SSE hook (legacy, being deprecated)
│   └── index.ts
├── store/
│   ├── types.ts           # Type definitions (includes TaskCreationPreferences)
│   ├── agent-manager-store.ts # Zustand store for tasks/agents/preferences
│   ├── message-store.ts   # Zustand store for messages
│   └── index.ts
├── hooks/
│   ├── use-agent-messages.ts    # Read-only hook for agent messages
│   ├── use-prompt-optimizer.ts  # Hook for AI-powered prompt optimization
│   └── index.ts
├── components/
│   ├── chat/
│   │   ├── chat-view.tsx      # Main chat container
│   │   ├── chat-message.tsx   # Individual message display
│   │   ├── chat-input.tsx     # Message input field (with optimize button)
│   │   └── index.ts
│   ├── tools/
│   │   ├── tool-call-display.tsx # Tool invocation display
│   │   ├── tools-section.tsx     # Tool grouping wrapper
│   │   ├── tool-config.ts        # Tool icons/colors config
│   │   └── index.ts
│   ├── agent-manager-view.tsx      # Task/agent view
│   ├── task-list-sidebar.tsx       # Task list
│   ├── create-task-dialog.tsx      # New task dialog (with preferences)
│   ├── optimization-review-dialog.tsx # Dialog for reviewing optimized prompts
│   ├── agent-tabs.tsx              # Agent tab switcher
│   ├── agent-actions.tsx           # Agent action buttons
│   ├── model-selector.tsx          # Model dropdown
│   ├── agent-type-selector.tsx     # Agent type dropdown
│   ├── source-selector.tsx         # Branch/commit selector
│   ├── status-badge.tsx            # Status indicator
│   ├── task-empty-state.tsx        # Empty state placeholder
│   └── index.ts
├── index.ts                    # Public exports
└── README.md                   # This file
```

## Usage

### Importing from Agent Manager

```typescript
// Components
import { ChatView, ChatMessage } from '@agent-manager/components';
import { ToolCallDisplay, ToolsSection } from '@agent-manager/components/tools';
import { AgentManagerView, CreateTaskDialog } from '@agent-manager/components';

// API client
import { opencodeClient } from '@agent-manager/api';

// SSE hook
import { useAgentSSE } from '@agent-manager/api';

// SSE manager (centralized connection management)
import { sseManager } from '@agent-manager/api';

// Message hook (read-only)
import { useAgentMessages, useAgentMessagesById } from '@agent-manager/hooks';

// Store
import { useAgentManagerStore } from '@agent-manager/store';
import { useMessageStore } from '@agent-manager/store';

// Types
import type { Task, TaskAgent } from '@agent-manager/store';
import type { Message, ToolInvocationPart, SSEEvent } from '@agent-manager/api';
```

## Architecture

### SSE Connection Management

The module uses a centralized `sseManager` singleton that maintains **one SSE connection per OpenCode server port**. This avoids race conditions and duplicate connections when multiple agents share the same port or when React components re-render.

```
┌─────────────────────────────────────────────────────────────┐
│                     sseManager (singleton)                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ connections: Map<port, EventSource>                     ││
│  │ subscribers: Map<`${port}:${sessionId}`, Set<callback>> ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                   useMessageStore (Zustand)                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ messages: Map<agentKey, Message[]>                      ││
│  │ streamingMessages: Map<agentKey, Message>               ││
│  │ pendingParts: Map<messageId, MessagePart[]>             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              useAgentMessages (read-only hook)              │
│  Returns: { messages, isLoading, streamingMessage }         │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Imperative SSE Management**: SSE connections are managed imperatively in store actions (not React hooks), eliminating race conditions on component mount/unmount.

2. **Single Connection Per Port**: Multiple sessions on the same port share one EventSource connection with event routing by session ID.

3. **Separation of Concerns**: 
   - `sseManager` handles connections
   - `useMessageStore` handles message state
   - `useAgentMessages` provides read-only React access

4. **Race Condition Handling**: The message store handles several SSE edge cases:
   - Parts arriving before their parent message (`pendingParts` buffer)
   - Rapid part updates during streaming (functional `set()` pattern)
   - Multiple messages in sequence (tool message then text response)
   - Duplicate `message.updated` events (ignored)

## API Client (`api/opencode.ts`)

The `opencodeClient` singleton manages HTTP communication with OpenCode servers.

### Connection

```typescript
import { opencodeClient } from '@agent-manager/api';

// Connect to server
opencodeClient.connect(port);

// Check connection
if (opencodeClient.isConnected()) {
  // ...
}

// Wait for server to be ready
const ready = await opencodeClient.waitForReady(10, 300);

// Disconnect
opencodeClient.disconnect();
```

### Sessions

```typescript
// Create a new session
const session = await opencodeClient.createSession('My Task');

// List all sessions
const sessions = await opencodeClient.listSessions();

// Set current session
opencodeClient.setSession(sessionId);

// Get current session ID
const sessionId = opencodeClient.getSession();
```

### Messages

```typescript
// Send prompt (sync - waits for response)
const response = await opencodeClient.sendPrompt('Fix the bug');

// Send prompt with model/agent options
const response = await opencodeClient.sendPromptWithOptions(prompt, {
  model: 'anthropic/claude-sonnet-4',
  agent: 'coder',
});

// Send prompt async (returns immediately)
await opencodeClient.sendPromptAsync(prompt, {
  model: 'anthropic/claude-sonnet-4',
  agent: 'coder',
});

// Get session messages
const messages = await opencodeClient.getSessionMessages();

// Get extended messages with tool parts
const extended = await opencodeClient.getSessionMessagesExtended();
```

### Providers and Agents

```typescript
// Get available providers and models
const { providers, default: defaults } = await opencodeClient.getProviders();

// Get provider info with connected status
const info = await opencodeClient.getProviderInfo();

// Get available agent types
const agents = await opencodeClient.getAgents();
```

### SSE Events

```typescript
// Subscribe to real-time events
const unsubscribe = opencodeClient.subscribeToEvents((event) => {
  console.log('Event:', event.type, event.properties);
});

// Later: unsubscribe
unsubscribe();
```

### Session Control

```typescript
// Abort a running session
await opencodeClient.abortSession(sessionId);

// Health check
const health = await opencodeClient.healthCheck();
```

## SSE Manager (`api/sse-manager.ts`)

The `sseManager` singleton manages centralized SSE connections.

```typescript
import { sseManager } from '@agent-manager/api';

// Connect to an OpenCode server port
sseManager.connect(port);

// Subscribe to events for a specific session
const unsubscribe = sseManager.subscribe(port, sessionId, agentKey, (event) => {
  console.log('SSE Event:', event.type, event.properties);
});

// Disconnect from a port (when no more subscribers)
sseManager.disconnect(port);

// Clean up on app shutdown
sseManager.disconnectAll();
```

### How It Works

1. `connect(port)` creates a single EventSource for that port (if not already connected)
2. `subscribe(port, sessionId, agentKey, callback)` registers a listener that receives events filtered by session ID
3. Events are dispatched to all subscribers whose session ID matches the event
4. `disconnect(port)` closes the connection and cleans up all subscribers

## Message Store (`store/message-store.ts`)

Dedicated Zustand store for agent messages with full streaming support.

```typescript
import { useMessageStore } from '@agent-manager/store';

// In a component (read-only access)
const messages = useMessageStore((s) => s.messages[agentKey] ?? []);
const isLoading = useMessageStore((s) => s.loading[agentKey] ?? false);
const streamingMessage = useMessageStore((s) => s.streamingMessages[agentKey]);

// In store actions (write access)
const messageStore = useMessageStore.getState();
messageStore.addUserMessage(agentKey, 'Fix the bug');
messageStore.handleSSEEvent(agentKey, event);
messageStore.loadMessages(agentKey, existingMessages);
```

### State Shape

| Field | Type | Description |
|-------|------|-------------|
| `messages` | `Record<agentKey, Message[]>` | Completed messages per agent |
| `streamingMessages` | `Record<agentKey, StreamingMessage>` | Current streaming message |
| `loading` | `Record<agentKey, boolean>` | Loading indicator per agent |
| `pendingParts` | `Record<pendingKey, APIPart[]>` | Parts that arrived before their message |

### SSE Event Handling

The message store uses functional `set()` for all state updates to avoid race conditions when SSE events arrive rapidly during streaming. Key behaviors:

1. **Part Buffering**: When `message.part.updated` arrives before `message.updated`, parts are buffered in `pendingParts` and applied when the message starts.

2. **Message Transitions**: When a new message starts while streaming another, the existing message is completed first (preserving its parts) before starting the new one.

3. **Duplicate Events**: Duplicate `message.updated` events for the same message ID are ignored.

## Agent Messages Hook (`hooks/use-agent-messages.ts`)

Read-only React hook for accessing agent messages.

```typescript
import { useAgentMessages, useAgentMessagesById } from '@agent-manager/hooks';

function ChatComponent({ taskId, agentId }) {
  // Using composite key directly
  const { messages, isLoading, streamingMessage } = useAgentMessages(`${taskId}:${agentId}`);

  // Or using task/agent IDs
  const { messages, isLoading, streamingMessage } = useAgentMessagesById(taskId, agentId);

  return (
    <div>
      {messages.map(msg => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isLoading && <LoadingIndicator />}
      {streamingMessage && <ChatMessage message={streamingMessage} isStreaming />}
    </div>
  );
}
```

## SSE Hook (`api/use-agent-sse.ts`) [Legacy]

> **Note**: This hook is being deprecated in favor of the imperative `sseManager` + `useMessageStore` approach. It's kept for backward compatibility.

```typescript
import { useAgentSSE } from '@agent-manager/api';

function ChatComponent({ taskId, agentId, port, sessionId }) {
  const {
    messages,        // StreamingMessage[]
    isConnected,     // boolean
    isProcessing,    // boolean (AI is generating)
    error,           // string | null
  } = useAgentSSE(taskId, agentId, port, sessionId);

  return (
    <div>
      {messages.map(msg => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
    </div>
  );
}
```

### SSE Event Types

| Event | Description |
|-------|-------------|
| `server.connected` | Initial connection established |
| `message.created` | New message started |
| `message.part.delta` | Message part update (text/tool) |
| `message.completed` | Message finished |
| `session.updated` | Session status changed |

## Store (`store/agent-manager-store.ts`)

Zustand store for agent manager state.

```typescript
import { useAgentManagerStore } from '@agent-manager/store';

function TaskList() {
  const {
    tasks,
    selectedTaskId,
    selectTask,
    loadTasks,
    createTask,
    deleteTask,
  } = useAgentManagerStore();

  // ...
}
```

### Store Actions

| Action | Description |
|--------|-------------|
| `loadTasks()` | Load tasks from backend (resets stale "running" statuses on app startup) |
| `selectTask(id)` | Select a task |
| `createTask(params)` | Create new task with agents |
| `deleteTask(id, deleteWorktrees)` | Delete task |
| `addAgentToTask(taskId, model)` | Add agent to task |
| `removeAgent(taskId, agentId)` | Remove agent |
| `acceptAgent(taskId, agentId)` | Mark agent as winner |
| `startAgent(taskId, agentId, prompt)` | Start an agent with OpenCode and send initial prompt |
| `stopAgent(taskId, agentId)` | Stop an agent and clean up SSE subscription |
| `sendFollowUp(taskId, agentId, prompt)` | Send a follow-up message to a running agent |
| `updateTaskStatusFromAgents(taskId)` | Update task status based on aggregate agent statuses |

## Types

### `Task`

```typescript
interface Task {
  id: string;                    // 8-char hash
  name: string;                  // User-friendly name
  sourceType: 'branch' | 'commit';
  sourceBranch?: string;
  sourceCommit?: string;
  sourceRepoPath: string;
  agentType: string;             // Default agent type
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  agents: TaskAgent[];
}

type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
```

### `TaskAgent`

```typescript
interface TaskAgent {
  id: string;                    // "agent-1", "agent-2", etc.
  modelId: string;               // e.g., "claude-sonnet-4"
  providerId: string;            // e.g., "anthropic"
  agentType?: string;            // Override task default
  worktreePath: string;          // Agent's isolated worktree
  sessionId?: string;            // OpenCode session ID
  status: AgentStatus;
  accepted: boolean;             // Is this the winner?
  createdAt: number;
}

type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
```

### `StreamingMessage` [Legacy]

> **Note**: This type is being deprecated. Use `Message` from `opencode-types.ts` instead.

```typescript
interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  parts: MessagePart[];
  isStreaming: boolean;
}

type MessagePart = TextPart | ToolInvocationPart | { type: string };

interface TextPart {
  type: 'text';
  text: string;
}

interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocationId: string;
  toolName: string;
  state: 'pending' | 'running' | 'result' | 'error' | 'completed';
  args?: unknown;
  result?: unknown;
}
```

### `Message` (New)

The new consolidated message type from `opencode-types.ts`:

```typescript
import type { Message, MessagePart, ToolInvocationPart } from '@agent-manager/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  time: string;
  parts: MessagePart[];
}

type MessagePart = TextPart | ToolInvocationPart | ReasoningPart;

interface TextPart {
  type: 'text';
  text: string;
}

interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocationId: string;
  toolName: string;
  state: 'pending' | 'running' | 'result' | 'error' | 'completed';
  args?: unknown;
  result?: unknown;
}

interface ReasoningPart {
  type: 'reasoning';
  text: string;
}
```

### SSE Event Types

```typescript
import type { SSEEvent, MessageUpdatedEvent, MessagePartUpdatedEvent } from '@agent-manager/api';

interface SSEEvent {
  type: string;
  properties: unknown;
}

interface MessageUpdatedEvent {
  type: 'message.updated';
  properties: {
    info: Message;
  };
}

interface MessagePartUpdatedEvent {
  type: 'message.part.updated';
  properties: {
    part: MessagePart;
    message: { id: string };
  };
}

interface SessionStatusEvent {
  type: 'session.status';
  properties: {
    id: string;
    status: 'idle' | 'busy';
  };
}
```

## Components

### `ChatView`

Displays chat messages with streaming support.

```typescript
import { ChatView } from '@agent-manager/components/chat';

<ChatView
  messages={messages}
  isProcessing={isProcessing}
/>
```

### `ChatMessage`

Renders a single message with markdown and tool calls.

```typescript
import { ChatMessage } from '@agent-manager/components/chat';

<ChatMessage message={message} />
```

### `ChatInput`

Message input with send button and integrated agent actions.

```typescript
import { ChatInput } from '@agent-manager/components/chat';

<ChatInput
  onSend={(prompt, sendToAll) => sendMessage(prompt, sendToAll)}
  disabled={isProcessing}
  agent={activeAgent}
  agentCount={agents.length}
  onAccept={handleAcceptAgent}
  onStop={handleStopAgent}
  onOpenTerminal={handleOpenTerminal}
  onOpenEditor={handleOpenEditor}
  onRevealInFinder={handleRevealInFinder}
  onRemove={handleRemoveAgent}
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `onSend` | `(message, sendToAll) => void` | Called when message is sent |
| `isLoading` | `boolean` | Disables input while processing |
| `disabled` | `boolean` | Disables the input |
| `placeholder` | `string` | Placeholder text |
| `agentCount` | `number` | Number of agents (shows "send to all" toggle if > 1) |
| `agent` | `TaskAgent` | Current agent (for displaying model info) |
| `onAccept` | `() => void` | Accept agent callback |
| `onStop` | `() => void` | Stop agent callback |
| `onOpenTerminal` | `() => void` | Open terminal callback |
| `onOpenEditor` | `() => void` | Open editor callback |
| `onRevealInFinder` | `() => void` | Reveal in Finder callback |
| `onRemove` | `() => void` | Remove agent callback |

### `ToolCallDisplay`

Renders a tool invocation with status, args, and result.

```typescript
import { ToolCallDisplay } from '@agent-manager/components/tools';

<ToolCallDisplay
  toolName="read"
  state="result"
  args={{ filePath: '/path/to/file' }}
  result={{ content: '...' }}
/>
```

### `ToolsSection`

Groups multiple tool calls together.

```typescript
import { ToolsSection } from '@agent-manager/components/tools';

<ToolsSection tools={toolParts} />
```

## Tool Configuration (`components/tools/tool-config.ts`)

Maps tool names to icons and colors for visual display.

```typescript
import { getToolConfig } from '@agent-manager/components/tools';

const config = getToolConfig('read');
// { icon: FileText, color: 'blue', label: 'Read File' }
```

### Supported Tools

| Tool | Icon | Color |
|------|------|-------|
| `read` | FileText | blue |
| `write` | FilePlus | green |
| `edit` | FileEdit | yellow |
| `bash` | Terminal | purple |
| `glob` | Search | cyan |
| `grep` | SearchCode | orange |
| `task` | Bot | pink |
| `todowrite` | ListTodo | indigo |
| `webfetch` | Globe | teal |

## Workflow Example

```typescript
import { useAgentManagerStore } from '@agent-manager/store';

// 1. User creates a task
const { createTask, startAgent, sendFollowUp } = useAgentManagerStore.getState();

const task = await createTask({
  name: 'Fix login bug',
  sourceType: 'branch',
  sourceBranch: 'main',
  sourceRepoPath: '/path/to/repo',
  agentType: 'coder',
  models: [
    { providerId: 'anthropic', modelId: 'claude-sonnet-4' },
    { providerId: 'openai', modelId: 'gpt-4o' },
  ],
});

// 2. Start an agent with initial prompt
// This handles: OpenCode server start, SSE connection, session creation, and prompt sending
await startAgent(task.id, 'agent-1', 'Fix the login bug in auth.ts');

// 3. UI automatically receives SSE events via the message store
// Components using useAgentMessages will re-render with new messages

// 4. Send follow-up messages
await sendFollowUp(task.id, 'agent-1', 'Also add unit tests');

// 5. When done, accept the best result
await commands.acceptAgent(task.id, 'agent-1');
await commands.cleanupUnacceptedAgents(task.id);
```

### React Component Example

```typescript
import { useAgentMessagesById } from '@agent-manager/hooks';
import { ChatMessage, ChatInput } from '@agent-manager/components/chat';
import { useAgentManagerStore } from '@agent-manager/store';

function AgentChat({ taskId, agentId }) {
  const { messages, isLoading, streamingMessage } = useAgentMessagesById(taskId, agentId);
  const sendFollowUp = useAgentManagerStore((s) => s.sendFollowUp);

  const handleSend = (prompt: string) => {
    sendFollowUp(taskId, agentId, prompt);
  };

  return (
    <div>
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {streamingMessage && <ChatMessage message={streamingMessage} isStreaming />}
      {isLoading && <LoadingIndicator />}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

## Error Handling

API calls throw errors that should be caught:

```typescript
try {
  await sendFollowUp(taskId, agentId, prompt);
} catch (error) {
  console.error('Failed to send prompt:', error);
  // Show error in UI
}
```

SSE connection errors are logged to the console. The `sseManager` handles reconnection automatically when `connect()` is called again.

```typescript
// Check loading state for UI feedback
const { isLoading } = useAgentMessages(agentKey);

if (isLoading) {
  return <LoadingIndicator />;
}
```

## Per-Repository Task Preferences

The agent manager persists task creation preferences per repository. When you create a task with specific settings (agent type, models, prompt), those settings are saved and automatically restored the next time you create a task for the same repository.

### Types

```typescript
interface TaskCreationPreferences {
  agentType: string;
  models: ModelSelection[];
  prompt: string;
}

type TaskPreferencesRecord = Record<string, TaskCreationPreferences>;
```

### Store Actions

```typescript
const {
  taskPreferences,      // Record<repoId, TaskCreationPreferences>
  saveTaskPreferences,  // (repoId, agentType, models, prompt) => void
  clearTaskPreferences, // (repoId) => void
  clearAllTaskPreferences, // () => void
} = useAgentManagerStore();
```

### Behavior

| Scenario | Behavior |
|----------|----------|
| First open for repo | Uses defaults (agent='build', empty models/prompt) |
| Create task in repo | Saves preferences keyed by repositoryId |
| Next open for same repo | Loads saved preferences for that repository |
| Different repository | Shows its own saved preferences (or defaults if none) |
| Clear preferences | Resets to defaults for that repository only |
| App restart | All preferences persist via zustand/persist |

### Data Shape in localStorage

```json
{
  "aristar-agent-manager-store": {
    "tasks": [...],
    "taskPreferences": {
      "repo-id-1": {
        "agentType": "build",
        "models": [{"providerId": "anthropic", "modelId": "claude-sonnet-4"}],
        "prompt": "Fix the bug in authentication"
      },
      "repo-id-2": {
        "agentType": "general",
        "models": [...],
        "prompt": "..."
      }
    }
  }
}
```

## Prompt Optimization

The chat input includes an "Optimize" button (wand icon) that uses AI to improve your prompt before sending.

### Configuration

Before using prompt optimization, you must configure an optimization model in Settings:

1. Open **Settings** (gear icon in the sidebar)
2. Navigate to the **Optimization** tab
3. Select an AI model to use for optimization
4. Save settings

**Note**: The optimize button is disabled until a model is configured. Hover over the button to see a tooltip indicating this.

### How It Works

1. User types a prompt in the chat input
2. Clicks the "Optimize" button (wand icon)
3. System sends the prompt to the configured optimization model
4. Optimized prompt appears in a review dialog
5. User can:
   - **Accept**: Replace original with optimized prompt
   - **Edit**: Manually tweak the optimized version
   - **Cancel**: Keep the original prompt

### Using the Hook

```typescript
import { usePromptOptimizer } from '@agent-manager/hooks';

function MyComponent() {
  const { optimize, isOptimizing, error, clearError } = usePromptOptimizer();

  const handleOptimize = async (prompt: string, repoPath: string, model: string) => {
    const result = await optimize(prompt, repoPath, model);
    if (result) {
      // Show result for review
      console.log('Optimized:', result);
    }
  };

  return (
    <button onClick={() => handleOptimize('fix bugs', '/path/to/repo', 'anthropic/claude-sonnet-4')}>
      {isOptimizing ? 'Optimizing...' : 'Optimize'}
    </button>
  );
}
```

### API Method

```typescript
// Direct API call (used by the hook internally)
const optimizedPrompt = await opencodeClient.optimizePrompt(
  'fix bugs in the auth module',
  'anthropic/claude-sonnet-4'
);
```

## Resource Cleanup

The module manages several resources that require cleanup on shutdown:

- **SSE connections**: EventSource connections to OpenCode servers
- **Module-level Maps**: `sseUnsubscribers` and `agentsBeingRecovered`
- **OpenCode client connections**: Per-agent client instances

### Cleanup Function

The module exports a cleanup function that should be called on app shutdown:

```typescript
import { cleanupAgentManagerResources } from '@agent-manager/store';

// In main.tsx or app cleanup handler
cleanupAgentManagerResources();
```

This function:
1. Calls all SSE unsubscribe functions
2. Clears the `sseUnsubscribers` Map
3. Clears the `agentsBeingRecovered` Set

### App Shutdown Flow

The cleanup is orchestrated in `main.tsx`:

```typescript
import { cleanupAgentManagerResources } from '@agent-manager/store/agent-manager-store';
import { sseManager } from '@agent-manager/store/sse-manager';
import { opencodeClientManager } from '@agent-manager/api/opencode';

function cleanupResources() {
  cleanupAgentManagerResources();  // Module-level Maps
  sseManager.disconnectAll();      // SSE connections
  opencodeClientManager.disconnectAll(); // Client connections
}

window.addEventListener('beforeunload', cleanupResources);
```

