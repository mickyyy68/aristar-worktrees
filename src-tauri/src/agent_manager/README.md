# Agent Manager Module

> **TL;DR**: AI agent orchestration including task management, multi-agent workflows, and OpenCode server process management.

## Overview

The `agent_manager` module enables running multiple AI agents on the same task. Each task can have multiple agents, each with its own:
- Git worktree (isolated codebase copy)
- OpenCode server instance
- Session state and status tracking

This allows comparing outputs from different AI models working on the same problem.

## File Structure

```
agent_manager/
├── mod.rs              # Module exports
├── types.rs            # Data structures (Task, TaskAgent, etc.)
├── task_operations.rs  # Task CRUD operations
├── agent_operations.rs # Agent management operations
├── opencode.rs         # OpenCode process manager
├── store.rs            # State management (TaskManagerState)
├── commands.rs         # Tauri commands (frontend API)
└── README.md           # This file
```

## Types

### `TaskStatus`

```rust
pub enum TaskStatus {
    Idle,       // Not started
    Running,    // At least one agent running
    Paused,     // Manually paused
    Completed,  // Successfully finished
    Failed,     // Failed with error
}
```

### `AgentStatus`

```rust
pub enum AgentStatus {
    Idle,       // Not started
    Running,    // OpenCode session active
    Paused,     // Manually paused
    Completed,  // Successfully finished
    Failed,     // Failed with error
}
```

### `TaskAgent`

An AI agent working on a task.

```rust
pub struct TaskAgent {
    pub id: String,                    // "agent-1", "agent-2", etc.
    pub model_id: String,              // e.g., "claude-sonnet-4"
    pub provider_id: String,           // e.g., "anthropic"
    pub agent_type: Option<String>,    // Override task's default
    pub worktree_path: String,         // Agent's isolated worktree
    pub session_id: Option<String>,    // OpenCode session ID
    pub status: AgentStatus,           // Current status
    pub accepted: bool,                // Is this the "winner"?
    pub created_at: i64,               // Timestamp (millis)
}
```

### `Task`

A task with multiple agents.

```rust
pub struct Task {
    pub id: String,                    // 8-char hash (e.g., "a1b2c3d4")
    pub name: String,                  // User-friendly name
    pub source_type: String,           // "branch" or "commit"
    pub source_branch: Option<String>, // Source branch name
    pub source_commit: Option<String>, // Source commit hash
    pub source_repo_path: String,      // Original repository path
    pub agent_type: String,            // Default agent type
    pub status: TaskStatus,            // Current status
    pub created_at: i64,               // Timestamp (millis)
    pub updated_at: i64,               // Last update timestamp
    pub agents: Vec<TaskAgent>,        // All agents
}
```

### `ModelSelection`

Used when creating a task to specify which models to use.

```rust
pub struct ModelSelection {
    pub provider_id: String,  // e.g., "anthropic", "openai"
    pub model_id: String,     // e.g., "claude-sonnet-4", "gpt-4o"
}
```

## State Management

### `TaskManagerState`

Thread-safe wrapper for task storage, managed by Tauri.

```rust
pub struct TaskManagerState {
    pub store: Mutex<TaskStoreData>,
}

impl TaskManagerState {
    pub fn new() -> Self          // Load from disk
    pub fn save(&self) -> Result  // Persist to disk
}
```

**Usage in main.rs:**
```rust
tauri::Builder::default()
    .manage(agent_manager::TaskManagerState::new())
    // ...
```

## OpenCode Manager

### `OpenCodeManager`

Manages OpenCode server instances for worktrees.

```rust
pub struct OpenCodeManager {
    instances: Mutex<HashMap<PathBuf, OpenCodeInstance>>,
}

impl OpenCodeManager {
    pub fn new() -> Self
    pub fn start(&self, worktree_path: PathBuf) -> Result<u16, String>
    pub fn stop(&self, worktree_path: &PathBuf) -> Result<(), String>
    pub fn stop_all(&self)  // Called on app exit
    pub fn get_port(&self, worktree_path: &PathBuf) -> Result<Option<u16>, String>
    pub fn is_running(&self, worktree_path: &PathBuf) -> bool
}
```

**Server Details:**
- Runs `opencode serve --port {port} --hostname 127.0.0.1`
- Uses `portpicker` to find available ports
- One instance per worktree path
- Reuses existing instance if already running

**OpenCode CLI Dependency:**

The agent manager requires the OpenCode CLI to be installed. The app looks for the binary in the following locations:

1. `~/.opencode/bin/opencode` (standard installation location)
2. Any directory in `PATH` environment variable

**Installation:**

Download OpenCode from https://opencode.ai and ensure the `opencode` binary is available. On macOS, the standard installation path is `~/.opencode/bin/opencode`.

**Usage in main.rs:**
```rust
tauri::Builder::default()
    .manage(agent_manager::OpenCodeManager::new())
    .on_window_event(|_app, event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Some(manager) = _app.try_state::<OpenCodeManager>() {
                manager.stop_all();  // Cleanup on exit
            }
        }
    })
```

## Tauri Commands

### Task Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `create_task` | `name, source_type, source_branch?, source_commit?, source_repo_path, agent_type, models[]` | `Task` | Create task with agents |
| `get_tasks` | - | `Vec<Task>` | List all tasks |
| `get_task` | `task_id` | `Task` | Get single task |
| `update_task` | `task_id, name?, status?` | `Task` | Update task properties |
| `delete_task` | `task_id, delete_worktrees` | `()` | Delete task |

### Agent Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `add_agent_to_task` | `task_id, model_id, provider_id, agent_type?` | `Task` | Add new agent |
| `remove_agent_from_task` | `task_id, agent_id, delete_worktree` | `()` | Remove agent |
| `update_agent_session` | `task_id, agent_id, session_id?` | `()` | Set session ID |
| `update_agent_status` | `task_id, agent_id, status` | `()` | Update status |
| `accept_agent` | `task_id, agent_id` | `()` | Mark as winner |
| `cleanup_unaccepted_agents` | `task_id` | `()` | Delete non-winners |

### Worktree Validation Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `validate_task_worktrees` | `task_id` | `Vec<String>` | Get orphaned agent IDs |
| `recreate_agent_worktree` | `task_id, agent_id` | `String` | Recreate missing worktree |

### Agent OpenCode Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `start_agent_opencode` | `task_id, agent_id` | `u16` | Start server, return port |
| `stop_agent_opencode` | `task_id, agent_id` | `()` | Stop server |
| `get_agent_opencode_port` | `task_id, agent_id` | `Option<u16>` | Get port if running |
| `stop_task_all_opencode` | `task_id` | `()` | Stop all agents' servers |

### Worktree OpenCode Commands

For the worktrees panel (not agent manager):

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `start_opencode` | `worktree_path` | `u16` | Start server |
| `stop_opencode` | `worktree_path` | `()` | Stop server |
| `get_opencode_status` | `worktree_path` | `Option<u16>` | Get port |
| `is_opencode_running` | `worktree_path` | `bool` | Check running |

## Task Storage

Tasks are stored in `~/.aristar-worktrees/`:

```
~/.aristar-worktrees/
├── tasks.json                    # Task metadata
└── tasks/                        # Task folders
    └── a1b2c3d4/                 # Task ID
        ├── my-task-claude-sonnet-4/   # Agent 1 worktree
        └── my-task-gpt-4o/            # Agent 2 worktree
```

### Task Folder Naming

Worktree folders are named: `{slugified-task-name}-{slugified-model-id}`

Example:
- Task: "Refactor Authentication"
- Model: "claude-sonnet-4"
- Folder: `refactor-authentication-claude-sonnet-4`

## Workflow Example

```typescript
// 1. Create a task with multiple models
const task = await invoke('create_task', {
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

// 2. Start OpenCode for each agent
for (const agent of task.agents) {
  const port = await invoke('start_agent_opencode', {
    taskId: task.id,
    agentId: agent.id,
  });
  console.log(`Agent ${agent.id} running on port ${port}`);
}

// 3. When done, accept the best result
await invoke('accept_agent', {
  taskId: task.id,
  agentId: 'agent-1',  // The winner
});

// 4. Cleanup unaccepted agents
await invoke('cleanup_unaccepted_agents', {
  taskId: task.id,
});
```

## Error Handling

All operations return `Result<T, String>`:
- Task/agent not found errors include the ID
- OpenCode spawn failures include the error message
- Worktree creation failures include git errors
