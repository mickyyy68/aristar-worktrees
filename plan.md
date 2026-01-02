# Agent Manager Implementation Plan

## Overview

This document outlines the implementation plan for a Cursor-like Agent Manager in Aristar Worktrees. The Agent Manager allows users to run multiple AI agents (with different models) in parallel on the same task, each operating in its own isolated worktree.

### Core Concepts

```
TASK = A goal/prompt to accomplish
├── ID: unique hash (e.g., "a1b2c3d4")
├── Name: "Refactor Authentication"
├── Source: branch "main" or commit "abc123"
├── Agent Type: "Build" (default for all agents, can override)
├── Status: Running | Paused | Completed | Failed | Idle
├── Folder: ~/.aristar-worktrees/tasks/{task-id}/
│
├── AGENT 1
│   ├── Model: claude-sonnet-4
│   ├── Worktree: ~/.aristar-worktrees/tasks/{task-id}/refactor-auth-claude-sonnet-4/
│   ├── Status: Running | Paused | Completed | Failed | Idle
│   ├── Session ID: OpenCode session ID
│   └── Accepted: boolean
│
├── AGENT 2
│   ├── Model: gpt-4
│   ├── Worktree: ~/.aristar-worktrees/tasks/{task-id}/refactor-auth-gpt-4/
│   └── ...
│
└── AGENT 3
    └── ...
```

### Key Features
- **Parallel execution**: Multiple models work on the same prompt simultaneously
- **Isolated worktrees**: Each agent gets its own worktree in a task folder
- **Tab-based comparison**: Click agent tabs to see each conversation
- **Follow-up options**: Send to all agents or specific one
- **Accept & cleanup**: Mark winner, optionally auto-delete others
- **Full integration**: Open in terminal/editor/finder per agent
- **Markdown rendering**: Rich display of agent responses

### Architecture Decisions
- **Storage**: `~/.aristar-worktrees/tasks/` for task folders and metadata
- **OpenCode Server**: One server per agent (each agent's worktree is the working directory for proper git context isolation)
- **UI**: Full-page Agent Manager view (toggled from header)
- **Persistence**: Tasks persist in `tasks.json` with full metadata

### OpenCode API Reference (Verified)
Key endpoints used:
- `GET /config/providers` - List providers and default models
- `GET /agent` - List available agents
- `GET /session` - List sessions
- `POST /session` - Create session with `{ parentID?, title? }`
- `POST /session/:id/message` - Send message with `{ parts, model?, agent? }`
- `POST /session/:id/abort` - Abort running session
- `GET /event` - SSE stream for real-time updates

Model format: `"provider/model-id"` (e.g., `"anthropic/claude-sonnet-4"`)

### Design Decisions
- **Repository selection**: Agent Manager has its own repository selector (independent of Worktrees view)
- **Initial prompt**: All agents start working immediately in parallel when task is created
- **Follow-up target**: Toggle checkbox "Send to all agents" (unchecked = send to active only)
- **Accepted agent**: Visual badge only (star/checkmark indicator)
- **Task naming**: Required field (validation error if empty)
- **Delete running task**: Confirm dialog "This will stop X running agents. Continue?"
- **View persistence**: Remember last active view (Worktrees vs Agent Manager) in localStorage

### Future Features
- **Create PR from accepted agent**: Allow creating a pull request directly from an accepted agent's worktree

---

## Phase 1: Data Models & Types

### 1.1 TypeScript Types
- [ ] Create `src/store/types/agent-manager.ts` with core types:
  ```typescript
  interface Task {
    id: string;                    // Unique hash
    name: string;                  // User-friendly name
    sourceType: 'branch' | 'commit';
    sourceBranch?: string;
    sourceCommit?: string;
    sourceRepoPath: string;        // Original repository path
    agentType: string;             // Default agent type (e.g., "build")
    status: TaskStatus;
    createdAt: number;
    updatedAt: number;
    agents: TaskAgent[];
  }
  
  type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  
  interface TaskAgent {
    id: string;                    // Unique ID within task
    modelId: string;               // e.g., "claude-sonnet-4"
    providerId: string;            // e.g., "anthropic"
    agentType?: string;            // Override task's default agent type
    worktreePath: string;          // Full path to worktree
    sessionId?: string;            // OpenCode session ID
    status: AgentStatus;
    accepted: boolean;
    createdAt: number;
  }
  
  interface OpenCodeProvider {
    id: string;
    name: string;
    models: OpenCodeModel[];
  }
  
  interface OpenCodeModel {
    id: string;
    name: string;
  }
  
  interface OpenCodeAgent {
    id: string;
    name: string;
    description: string;
    mode: 'primary' | 'subagent' | 'all';
  }
  ```

- [ ] Export types from `src/store/types.ts`

### 1.2 Rust Types
- [ ] Create `src-tauri/src/models/task.rs` with Rust structs:
  ```rust
  #[derive(Serialize, Deserialize, Clone)]
  pub struct Task { ... }
  
  #[derive(Serialize, Deserialize, Clone)]
  pub struct TaskAgent { ... }
  ```

- [ ] Update `src-tauri/src/models/mod.rs` to export task types

---

## Phase 2: Rust Backend Commands

### 2.1 Task Storage Functions
- [ ] Create `src-tauri/src/commands/task_manager.rs`
- [ ] Implement `get_tasks_base_path()` -> `~/.aristar-worktrees/tasks/`
- [ ] Implement `get_tasks_store_path()` -> `~/.aristar-worktrees/tasks.json`
- [ ] Implement `generate_task_id(name: &str)` -> 8-char hash
- [ ] Implement `load_tasks()` -> `Vec<Task>`
- [ ] Implement `save_tasks(tasks: &Vec<Task>)`
- [ ] Implement `get_task_folder_path(task_id: &str)` -> PathBuf

### 2.2 Task CRUD Commands
- [ ] Implement `create_task` command:
  - Parameters: `name`, `source_type`, `source_branch`, `source_commit`, `source_repo_path`, `agent_type`, `models: Vec<ModelSelection>`
  - Creates task folder: `~/.aristar-worktrees/tasks/{task-id}/`
  - Creates worktree for each model: `~/.aristar-worktrees/tasks/{task-id}/{task-name}-{model-slug}/`
  - Returns created `Task`

- [ ] Implement `get_tasks` command:
  - Returns all tasks from `tasks.json`

- [ ] Implement `get_task` command:
  - Parameters: `task_id`
  - Returns single `Task`

- [ ] Implement `update_task` command:
  - Parameters: `task_id`, optional fields to update
  - Updates task metadata

- [ ] Implement `delete_task` command:
  - Parameters: `task_id`, `delete_worktrees: bool`
  - Removes task and optionally all worktrees

### 2.3 Agent Management Commands
- [ ] Implement `add_agent_to_task` command:
  - Parameters: `task_id`, `model_id`, `provider_id`, `agent_type`
  - Creates new worktree for the agent
  - Returns updated `Task`

- [ ] Implement `remove_agent_from_task` command:
  - Parameters: `task_id`, `agent_id`, `delete_worktree: bool`
  - Removes agent and optionally its worktree

- [ ] Implement `accept_agent` command:
  - Parameters: `task_id`, `agent_id`
  - Marks agent as accepted

- [ ] Implement `cleanup_unaccepted_agents` command:
  - Parameters: `task_id`
  - Deletes worktrees for non-accepted agents

### 2.4 Agent OpenCode Integration
- [ ] Implement `start_agent_opencode` command:
  - Parameters: `task_id`, `agent_id`
  - Starts OpenCode server for the agent (uses agent's worktree as working dir)
  - Returns port number

- [ ] Implement `stop_agent_opencode` command:
  - Parameters: `task_id`, `agent_id`
  - Stops OpenCode server for the agent

- [ ] Implement `get_agent_opencode_port` command:
  - Parameters: `task_id`, `agent_id`
  - Returns port if running, null otherwise

- [ ] Implement `stop_task_all_opencode` command:
  - Parameters: `task_id`
  - Stops all OpenCode servers for all agents in the task

### 2.5 Register Commands
- [ ] Add all new commands to `src-tauri/src/main.rs` invoke_handler
- [ ] Add `TaskManager` state to Tauri app

---

## Phase 3: OpenCode Client Extensions

### 3.1 Extend OpenCode Client
- [ ] Add to `src/lib/opencode.ts`:
  ```typescript
  // Provider & Model fetching (GET /config/providers, GET /agent)
  async getProviders(): Promise<{ providers: OpenCodeProvider[]; default: Record<string, string> }>
  async getAgents(): Promise<OpenCodeAgentInfo[]>
  
  // Session with model/agent support (POST /session/:id/message)
  // Note: model is a single string "provider/model-id" format
  async sendPromptWithOptions(prompt: string, options: {
    model?: string;  // e.g., "anthropic/claude-sonnet-4"
    agent?: string;
  }): Promise<OpenCodeMessage>
  
  // Async prompt (POST /session/:id/prompt_async) - returns immediately
  async sendPromptAsync(prompt: string, options?: { model?: string; agent?: string }): Promise<void>
  
  // Session management (POST /session/:id/abort)
  async abortSession(sessionId: string): Promise<boolean>
  
  // Event subscription (GET /event - SSE stream)
  subscribeToEvents(onEvent: (event: any) => void): () => void
  
  // Extended messages with parts
  async getSessionMessagesExtended(): Promise<OpenCodeMessageExtended[]>
  ```

### 3.2 Add Message Types
- [ ] Extend `OpenCodeMessage` interface to include:
  - `parts: MessagePart[]` (for tool calls, code blocks, etc.)
  - `status?: 'pending' | 'streaming' | 'complete' | 'error'`

- [ ] Add `MessagePart` type:
  ```typescript
  type MessagePart = 
    | { type: 'text'; text: string }
    | { type: 'tool-call'; toolName: string; args: any; result?: any }
    | { type: 'code'; language: string; code: string }
  ```

---

## Phase 4: Zustand Store - Agent Manager

### 4.1 Create Agent Manager Store Slice
- [ ] Create `src/store/agent-manager-store.ts` with:
  ```typescript
  interface AgentManagerState {
    // Data
    tasks: Task[];
    activeTaskId: string | null;
    activeAgentId: string | null;
    
    // OpenCode data
    providers: OpenCodeProvider[];
    availableAgents: OpenCodeAgent[];
    
    // UI State
    isLoading: boolean;
    error: string | null;
    
    // Per-agent chat state
    agentMessages: Record<string, OpenCodeMessage[]>; // agentId -> messages
    agentLoading: Record<string, boolean>;
  }
  
  interface AgentManagerActions {
    // Task CRUD
    loadTasks: () => Promise<void>;
    createTask: (params: CreateTaskParams) => Promise<Task>;
    deleteTask: (taskId: string, deleteWorktrees: boolean) => Promise<void>;
    
    // Agent management
    addAgentToTask: (taskId: string, model: ModelSelection) => Promise<void>;
    removeAgentFromTask: (taskId: string, agentId: string) => Promise<void>;
    acceptAgent: (taskId: string, agentId: string) => Promise<void>;
    cleanupUnacceptedAgents: (taskId: string) => Promise<void>;
    
    // Task execution
    startTask: (taskId: string, initialPrompt: string) => Promise<void>;
    pauseAgent: (taskId: string, agentId: string) => Promise<void>;
    resumeAgent: (taskId: string, agentId: string) => Promise<void>;
    stopAgent: (taskId: string, agentId: string) => Promise<void>;
    
    // Follow-ups
    sendFollowUp: (taskId: string, prompt: string, targetAgentIds?: string[]) => Promise<void>;
    
    // OpenCode data
    loadProviders: () => Promise<void>;
    loadAvailableAgents: () => Promise<void>;
    
    // Navigation
    setActiveTask: (taskId: string | null) => void;
    setActiveAgent: (agentId: string | null) => void;
    
    // Messages
    loadAgentMessages: (taskId: string, agentId: string) => Promise<void>;
  }
  ```

### 4.2 Integrate with App Store
- [ ] Add `agentManager` slice to main `useAppStore`
- [ ] Or create separate `useAgentManagerStore` (preferred for separation)

---

## Phase 5: Frontend Commands Bridge

### 5.1 Add Commands to `src/lib/commands.ts`
- [ ] Add task commands:
  ```typescript
  export async function createTask(...): Promise<Task>
  export async function getTasks(): Promise<Task[]>
  export async function getTask(taskId: string): Promise<Task>
  export async function updateTask(...): Promise<Task>
  export async function deleteTask(taskId: string, deleteWorktrees: boolean): Promise<void>
  ```

- [ ] Add agent commands:
  ```typescript
  export async function addAgentToTask(...): Promise<Task>
  export async function removeAgentFromTask(...): Promise<void>
  export async function acceptAgent(...): Promise<void>
  export async function cleanupUnacceptedAgents(...): Promise<void>
  ```

- [ ] Add agent OpenCode commands:
  ```typescript
  export async function startAgentOpencode(taskId: string, agentId: string): Promise<number>
  export async function stopAgentOpencode(taskId: string, agentId: string): Promise<void>
  export async function getAgentOpencodePort(taskId: string, agentId: string): Promise<number | null>
  export async function stopTaskAllOpencode(taskId: string): Promise<void>
  ```

---

## Phase 6: UI Components - Core

### 6.1 Install Dependencies
- [ ] Install markdown rendering: `bun add react-markdown remark-gfm`
- [ ] Install syntax highlighting: `bun add react-syntax-highlighter @types/react-syntax-highlighter`

### 6.2 App Layout & Navigation
- [ ] Update `src/components/header.tsx`:
  - Add view toggle: `[Worktrees] [Agent Manager]`
  - Store active view in app state

- [ ] Update `src/App.tsx`:
  - Add routing/conditional rendering based on active view
  - Render `<WorktreesView />` or `<AgentManagerView />`

### 6.3 Create Base Components
- [ ] Create `src/components/ui/markdown-renderer.tsx`:
  - Render markdown with syntax highlighting
  - Support code blocks with copy button
  - Handle inline code, links, lists, etc.

- [ ] Create `src/components/agent-manager/status-badge.tsx`:
  - Display status with appropriate icon and color
  - Statuses: running (green pulse), paused (yellow), completed (green check), failed (red), idle (gray)

- [ ] Create `src/components/agent-manager/model-selector.tsx`:
  - Multi-select dropdown for models
  - Group by provider
  - Search/filter capability
  - Show checkboxes for each model

- [ ] Create `src/components/agent-manager/agent-type-selector.tsx`:
  - Single-select dropdown for agent type (Build, Plan, etc.)
  - Fetches from OpenCode `/agent` endpoint

---

## Phase 7: UI Components - Agent Manager Page

### 7.1 Main Layout
- [ ] Create `src/components/agent-manager/agent-manager-view.tsx`:
  ```
  ┌─────────────────────────────────────────────────────────────────┐
  │                           HEADER                                 │
  ├─────────────────────────────────────────────────┬───────────────┤
  │                                                 │               │
  │              TASK DETAIL AREA                   │   TASK LIST   │
  │                                                 │   SIDEBAR     │
  │                                                 │               │
  └─────────────────────────────────────────────────┴───────────────┘
  ```

### 7.2 Task List Sidebar
- [ ] Create `src/components/agent-manager/task-list-sidebar.tsx`:
  - "New Task" button at top
  - List of all tasks with:
    - Task name
    - Status indicator
    - Timestamp
  - Click to select/activate task
  - Active task highlighted

### 7.3 Task Detail Area (Empty State)
- [ ] Create `src/components/agent-manager/task-empty-state.tsx`:
  - Shown when no task is selected
  - Prompt to create new task or select existing

### 7.4 Task Detail Area (With Task)
- [ ] Create `src/components/agent-manager/task-detail.tsx`:
  - Task header: name, source branch, agent count, status
  - Agent tabs: one tab per agent (model name + status)
  - Active agent's chat view
  - Input area at bottom

### 7.5 Agent Tabs
- [ ] Create `src/components/agent-manager/agent-tabs.tsx`:
  - Horizontal tabs showing all agents for current task
  - Each tab shows: model name, status badge
  - Click to switch active agent
  - Visual indicator for accepted agent

### 7.6 Chat View
- [ ] Create `src/components/agent-manager/chat-view.tsx`:
  - Scrollable message list
  - User messages (right-aligned)
  - Assistant messages (left-aligned, with markdown)
  - Loading indicator when agent is working
  - Tool call indicators (expandable)

### 7.7 Message Components
- [ ] Create `src/components/agent-manager/chat-message.tsx`:
  - Render single message
  - Different styles for user/assistant
  - Markdown rendering for assistant messages
  - Timestamp display

- [ ] Create `src/components/agent-manager/tool-call-display.tsx`:
  - Collapsible display for tool calls
  - Show tool name, arguments, result

### 7.8 Input Area
- [ ] Create `src/components/agent-manager/chat-input.tsx`:
  - Text input (expandable textarea)
  - Send button
  - Agent type selector (inline)
  - Model display (shows current agent's model)
  - Option to send to all agents or just active

### 7.9 Agent Actions
- [ ] Create `src/components/agent-manager/agent-actions.tsx`:
  - Buttons for active agent:
    - Pause/Resume
    - Stop
    - Accept (marks as winner)
    - Open in Terminal
    - Open in Editor
    - Reveal in Finder
  - Integrated into task detail header or as dropdown

---

## Phase 8: UI Components - New Task Dialog

### 8.1 Create Task Dialog
- [ ] Create `src/components/agent-manager/create-task-dialog.tsx`:
  - Cursor-style centered input area
  - Fields:
    - Task name (auto-generated from prompt if empty)
    - Source selection (branch dropdown or commit input)
    - Agent type selector
    - Model multi-selector
    - Initial prompt (large textarea)
  - Preview of worktree names
  - Create & Run button

### 8.2 Source Selection Component
- [ ] Create `src/components/agent-manager/source-selector.tsx`:
  - Reuse logic from existing create-worktree-dialog
  - Radio: Current Branch | Existing Branch | Specific Commit
  - Branch dropdown (when applicable)
  - Commit input (when applicable)
  - Repository selector (if multiple repos)

---

## Phase 9: Integration & Wiring

### 9.1 Wire Up Task Creation Flow
- [ ] Connect create-task-dialog to store
- [ ] On submit:
  1. Call `createTask` command
  2. Start OpenCode server for task
  3. Create sessions for each agent
  4. Send initial prompt to all agents
  5. Navigate to task detail view

### 9.2 Wire Up Chat Flow
- [ ] Connect chat-input to store
- [ ] On send:
  1. Add user message to UI immediately
  2. Send prompt to selected agent(s)
  3. Update messages as responses stream in
  4. Update agent status

### 9.3 Wire Up Agent Actions
- [ ] Connect pause/resume/stop buttons to store
- [ ] Connect accept button to store
- [ ] Connect cleanup action to store

### 9.4 Real-time Updates
- [ ] Subscribe to OpenCode events on task activation
- [ ] Update message list as events arrive
- [ ] Update agent status based on events

---

## Phase 10: Task Persistence & Recovery

### 10.1 Persistence
- [ ] Save tasks to `tasks.json` on every change
- [ ] Load tasks on app startup
- [ ] Validate task data (check if worktrees still exist)

### 10.2 Recovery
- [ ] Handle case where worktrees were manually deleted
- [ ] Mark agents as "orphaned" if worktree missing
- [ ] Provide option to recreate or remove orphaned agents

### 10.3 OpenCode Server Recovery
- [ ] On task activation, check if OpenCode server is running
- [ ] If not, start it automatically
- [ ] Restore sessions from OpenCode's own persistence

---

## Phase 11: Polish & UX

### 11.1 Loading States
- [ ] Add skeleton loaders for task list
- [ ] Add skeleton loaders for chat messages
- [ ] Add loading spinner for task creation

### 11.2 Error Handling
- [ ] Display errors in toast notifications
- [ ] Handle OpenCode connection failures gracefully
- [ ] Retry logic for transient failures

### 11.3 Confirmations
- [ ] Confirm before deleting task
- [ ] Confirm before cleaning up unaccepted agents
- [ ] Confirm before stopping running agent

### 11.4 Keyboard Shortcuts
- [ ] Tab to switch between agents
- [ ] Cmd+Enter to send message
- [ ] Cmd+N for new task
- [ ] Escape to close dialogs

### 11.5 Responsive Design
- [ ] Ensure Agent Manager works on smaller screens
- [ ] Collapsible sidebar on narrow viewports

---

## Phase 12: Testing

### 12.1 Rust Unit Tests
- [ ] Test task CRUD operations
- [ ] Test worktree creation for tasks
- [ ] Test task ID generation
- [ ] Test agent management functions

### 12.2 Integration Tests
- [ ] Test full task creation flow
- [ ] Test OpenCode server lifecycle
- [ ] Test message sending and receiving

### 12.3 Frontend Tests
- [ ] Test store actions
- [ ] Test component rendering
- [ ] Test user interactions

---

## Phase 13: Documentation

### 13.1 Update AGENTS.md
- [ ] Document new commands
- [ ] Document new components
- [ ] Document store structure

### 13.2 User Documentation
- [ ] Add Agent Manager section to README
- [ ] Include screenshots
- [ ] Document workflows

---

## File Structure Summary

```
src/
├── components/
│   ├── agent-manager/
│   │   ├── agent-manager-view.tsx      # Main page component
│   │   ├── task-list-sidebar.tsx       # Left sidebar with task list
│   │   ├── task-detail.tsx             # Main task view
│   │   ├── task-empty-state.tsx        # Empty state when no task selected
│   │   ├── agent-tabs.tsx              # Tabs for switching agents
│   │   ├── chat-view.tsx               # Message list
│   │   ├── chat-message.tsx            # Single message component
│   │   ├── chat-input.tsx              # Input area
│   │   ├── tool-call-display.tsx       # Tool call visualization
│   │   ├── agent-actions.tsx           # Action buttons
│   │   ├── create-task-dialog.tsx      # New task modal
│   │   ├── source-selector.tsx         # Branch/commit selector
│   │   ├── model-selector.tsx          # Multi-model picker
│   │   ├── agent-type-selector.tsx     # Agent type dropdown
│   │   └── status-badge.tsx            # Status indicator
│   └── ui/
│       └── markdown-renderer.tsx       # Markdown display component
├── store/
│   ├── types/
│   │   └── agent-manager.ts            # TypeScript types
│   ├── agent-manager-store.ts          # Zustand store
│   └── use-app-store.ts                # Updated with view toggle
└── lib/
    ├── commands.ts                     # Updated with task commands
    └── opencode.ts                     # Extended OpenCode client

src-tauri/src/
├── commands/
│   ├── task_manager.rs                 # Task management
│   ├── mod.rs                          # Updated exports
│   └── ...
├── models/
│   ├── task.rs                         # Task types
│   └── mod.rs                          # Updated exports
└── main.rs                             # Updated with new commands
```

---

## Estimated Effort

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Data Models & Types | Low |
| 2 | Rust Backend Commands | High |
| 3 | OpenCode Client Extensions | Medium |
| 4 | Zustand Store | Medium |
| 5 | Frontend Commands Bridge | Low |
| 6 | UI Components - Core | Medium |
| 7 | UI Components - Agent Manager | High |
| 8 | UI Components - New Task Dialog | Medium |
| 9 | Integration & Wiring | High |
| 10 | Persistence & Recovery | Medium |
| 11 | Polish & UX | Medium |
| 12 | Testing | Medium |
| 13 | Documentation | Low |

---

## Notes

- The Agent Manager is completely separate from the existing Worktrees view
- Tasks and their worktrees are stored in `~/.aristar-worktrees/tasks/`
- One OpenCode server runs per task (manages all agents as sessions)
- Agent templates come from OpenCode's built-in agents (Build, Plan, etc.)
- Model list is fetched dynamically from OpenCode's `/config/providers` endpoint
