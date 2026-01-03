# Agent Manager Module

> **TL;DR**: AI agent orchestration UI for running multiple AI models on the same task, with real-time streaming via SSE, chat interface, and tool call visualization.

## Overview

The `agent-manager` module provides the frontend for the AI agent orchestration system:

- **Task Management**: Create and manage tasks with multiple AI agents
- **OpenCode Integration**: Connect to OpenCode servers for each agent's worktree
- **Real-time Streaming**: SSE-based event streaming for live updates
- **Chat Interface**: Send prompts and view AI responses
- **Tool Visualization**: Display tool calls and their results

## File Structure

```
agent-manager/
├── api/
│   ├── opencode.ts        # OpenCode HTTP client
│   ├── use-agent-sse.ts   # SSE hook for real-time events
│   └── index.ts
├── store/
│   ├── types.ts           # Type definitions
│   ├── agent-manager-store.ts # Zustand store
│   └── index.ts
├── components/
│   ├── chat/
│   │   ├── chat-view.tsx      # Main chat container
│   │   ├── chat-message.tsx   # Individual message display
│   │   ├── chat-input.tsx     # Message input field
│   │   └── index.ts
│   ├── tools/
│   │   ├── tool-call-display.tsx # Tool invocation display
│   │   ├── tools-section.tsx     # Tool grouping wrapper
│   │   ├── tool-config.ts        # Tool icons/colors config
│   │   └── index.ts
│   ├── opencode-panel.tsx      # Main panel container
│   ├── agent-manager-view.tsx  # Task/agent view
│   ├── task-list-sidebar.tsx   # Task list
│   ├── create-task-dialog.tsx  # New task dialog
│   ├── agent-tabs.tsx          # Agent tab switcher
│   ├── agent-actions.tsx       # Agent action buttons
│   ├── model-selector.tsx      # Model dropdown
│   ├── agent-type-selector.tsx # Agent type dropdown
│   ├── source-selector.tsx     # Branch/commit selector
│   ├── status-badge.tsx        # Status indicator
│   ├── task-empty-state.tsx    # Empty state placeholder
│   └── index.ts
├── index.ts                    # Public exports
└── README.md                   # This file
```

## Usage

### Importing from Agent Manager

```typescript
// Components
import { OpenCodePanel, ChatView, ChatMessage } from '@agent-manager/components';
import { ToolCallDisplay, ToolsSection } from '@agent-manager/components/tools';
import { AgentManagerView, CreateTaskDialog } from '@agent-manager/components';

// API client
import { opencodeClient } from '@agent-manager/api';

// SSE hook
import { useAgentSSE } from '@agent-manager/api';

// Store
import { useAgentManagerStore } from '@agent-manager/store';

// Types
import type { Task, TaskAgent, StreamingMessage } from '@agent-manager/store';
```

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

## SSE Hook (`api/use-agent-sse.ts`)

The `useAgentSSE` hook manages SSE connections and message state.

```typescript
import { useAgentSSE } from '@agent-manager/api';

function ChatComponent({ port, sessionId }) {
  const {
    messages,        // StreamingMessage[]
    isConnected,     // boolean
    isProcessing,    // boolean (AI is generating)
    error,           // string | null
  } = useAgentSSE(port, sessionId);

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
| `loadTasks()` | Load tasks from backend |
| `selectTask(id)` | Select a task |
| `createTask(params)` | Create new task with agents |
| `deleteTask(id, deleteWorktrees)` | Delete task |
| `addAgentToTask(taskId, model)` | Add agent to task |
| `removeAgent(taskId, agentId)` | Remove agent |
| `acceptAgent(taskId, agentId)` | Mark agent as winner |

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

### `StreamingMessage`

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

## Components

### `OpenCodePanel`

Main entry point for the agent manager UI. Can be opened for a specific worktree.

```typescript
import { OpenCodePanel } from '@agent-manager/components';

<OpenCodePanel />
```

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

Message input with send button.

```typescript
import { ChatInput } from '@agent-manager/components/chat';

<ChatInput
  onSend={(prompt) => sendMessage(prompt)}
  disabled={isProcessing}
/>
```

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
// 1. User creates a task
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

// 2. Start OpenCode server for an agent
const port = await commands.startAgentOpencode(task.id, 'agent-1');

// 3. Connect client
opencodeClient.connect(port);
await opencodeClient.waitForReady();

// 4. Create session and send prompt
const session = await opencodeClient.createSession();
await opencodeClient.sendPromptAsync('Fix the login bug in auth.ts');

// 5. UI receives SSE events and updates in real-time

// 6. When done, accept the best result
await commands.acceptAgent(task.id, 'agent-1');
await commands.cleanupUnacceptedAgents(task.id);
```

## Error Handling

API calls throw errors that should be caught:

```typescript
try {
  await opencodeClient.sendPromptAsync(prompt);
} catch (error) {
  console.error('Failed to send prompt:', error);
  // Show error in UI
}
```

SSE connection errors are exposed via the hook:

```typescript
const { error } = useAgentSSE(port, sessionId);

if (error) {
  return <ErrorMessage message={error} />;
}
```
