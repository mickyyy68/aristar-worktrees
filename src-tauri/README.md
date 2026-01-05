# Aristar Worktrees - Rust Backend

> **TL;DR**: Tauri backend for git worktree management and AI agent orchestration, built with a modular architecture.

## Overview

This is the Rust backend for Aristar Worktrees, providing:

- **Git Worktree Management**: Create, remove, rename, lock/unlock worktrees
- **Repository Management**: Track multiple repositories with their worktrees
- **Agent Manager**: Run multiple AI agents on the same task with isolated worktrees
- **OpenCode Integration**: Manage OpenCode server instances for each agent
- **External App Integration**: Open worktrees in terminals and editors

## Architecture

```
src-tauri/src/
├── main.rs              # Tauri app entry point
├── lib.rs               # Library exports
│
├── core/                # Shared infrastructure
│   ├── persistence.rs   # JSON store load/save
│   ├── system.rs        # Clipboard, Finder integration
│   └── types.rs         # AppSettings
│
├── worktrees/           # Git worktree management
│   ├── types.rs         # WorktreeInfo, Repository, etc.
│   ├── operations.rs    # Git worktree operations
│   ├── external_apps.rs # Terminal/editor integration
│   ├── store.rs         # AppState management
│   └── commands.rs      # Tauri commands
│
├── agent_manager/       # AI agent orchestration
│   ├── types.rs         # Task, TaskAgent, etc.
│   ├── task_operations.rs   # Task CRUD
│   ├── agent_operations.rs  # Agent management
│   ├── opencode.rs      # OpenCode process manager
│   ├── store.rs         # TaskManagerState
│   └── commands.rs      # Tauri commands
│
└── tests/               # Test suite
    ├── helpers.rs       # TestRepo fixture
    ├── worktrees/       # Worktree tests
    └── agent_manager/   # Agent manager tests
```

## Module Documentation

Each module has its own README with detailed documentation:

| Module | README | Description |
|--------|--------|-------------|
| `core` | [core/README.md](src/core/README.md) | Persistence, system utils, shared types |
| `worktrees` | [worktrees/README.md](src/worktrees/README.md) | Git worktree operations, commands |
| `agent_manager` | [agent_manager/README.md](src/agent_manager/README.md) | Task/agent management, OpenCode |
| `tests` | [tests/README.md](src/tests/README.md) | Test utilities and structure |

## Quick Start

### Development

```bash
cd src-tauri

# Check compilation
cargo check

# Build
cargo build

# Run tests
cargo test

# Lint
cargo clippy

# Format
cargo fmt
```

### Running with Frontend

```bash
# From project root
bun run tauri dev
```

## Tauri Commands

All commands are exposed to the frontend via `invoke()`.

### Repository & Worktree Commands

| Command | Description |
|---------|-------------|
| `get_repositories` | List all tracked repositories |
| `add_repository` | Add a new git repository |
| `remove_repository` | Remove a repository from tracking |
| `refresh_repository` | Rescan worktrees for a repository |
| `list_worktrees` | List worktrees for a repository |
| `create_worktree` | Create a new worktree |
| `remove_worktree` | Remove a worktree |
| `rename_worktree` | Rename a worktree |
| `lock_worktree` | Lock a worktree |
| `unlock_worktree` | Unlock a worktree |
| `get_branches` | Get branches for a repository |
| `get_commits` | Get recent commits |

### External App Commands

| Command | Description |
|---------|-------------|
| `open_in_terminal` | Open path in terminal app |
| `open_in_editor` | Open path in editor app |
| `reveal_in_finder` | Show path in Finder |
| `copy_to_clipboard` | Copy text to clipboard |

### Task Manager Commands

| Command | Description |
|---------|-------------|
| `create_task` | Create task with multiple agents |
| `get_tasks` | List all tasks |
| `get_task` | Get a single task |
| `update_task` | Update task properties |
| `delete_task` | Delete a task |
| `add_agent_to_task` | Add agent to existing task |
| `remove_agent_from_task` | Remove agent from task |
| `update_agent_status` | Update agent status |
| `accept_agent` | Mark agent as winner |
| `cleanup_unaccepted_agents` | Remove non-winning agents |

### OpenCode Commands

| Command | Description |
|---------|-------------|
| `start_opencode` | Start OpenCode for worktree |
| `stop_opencode` | Stop OpenCode for worktree |
| `get_opencode_status` | Get OpenCode port |
| `is_opencode_running` | Check if OpenCode running |
| `start_agent_opencode` | Start OpenCode for agent |
| `stop_agent_opencode` | Stop OpenCode for agent |
| `stop_task_all_opencode` | Stop all agents' OpenCode |

## Data Storage

All data is stored in `~/.aristar-worktrees/`:

```
~/.aristar-worktrees/
├── store.json           # Repositories and settings
├── tasks.json           # Task manager data
├── tasks/               # Task worktree folders
│   └── {task-id}/       # Individual task folder
│       └── {worktree}/  # Agent worktrees
└── {repo-hash}/         # Repository worktrees
    ├── .aristar-repo-info.json
    └── {worktree-name}/ # Worktree folders
```

## State Management

The backend uses two Tauri-managed state objects:

1. **`AppState`** (worktrees module)
   - Stores: repositories, worktrees, settings
   - Persisted to: `store.json`

2. **`TaskManagerState`** (agent_manager module)
   - Stores: tasks, agents
   - Persisted to: `tasks.json`

3. **`OpenCodeManager`** (agent_manager module)
   - Stores: running OpenCode instances (in-memory only)
   - Cleaned up on app exit

## Testing

```bash
# Run all tests
cargo test

# Run specific module tests
cargo test tests::worktrees::operations_tests
cargo test tests::worktrees::integration_tests
cargo test tests::agent_manager::task_tests

# Run with output
cargo test -- --nocapture
```

Current test count: **54 tests**

## Adding New Commands

1. Add the function to the appropriate `commands.rs` file
2. Add the `#[tauri::command]` attribute
3. Register in `main.rs` under `invoke_handler`

Example:

```rust
// In worktrees/commands.rs
#[tauri::command]
pub fn my_new_command(state: State<AppState>, param: String) -> Result<(), String> {
    // Implementation
    Ok(())
}

// In main.rs
.invoke_handler(tauri::generate_handler![
    // ...existing commands
    worktrees::commands::my_new_command,
])
```

## Dependencies

Key dependencies:

| Crate | Purpose |
|-------|---------|
| `tauri` | Application framework |
| `serde` | Serialization |
| `chrono` | Timestamps |
| `uuid` | ID generation |
| `sha2` / `hex` | Path hashing |
| `portpicker` | Find available ports |
| `tempfile` | Test fixtures |

## Platform Support

Currently **macOS only**:
- Terminal integration uses AppleScript and `open -a`
- Clipboard uses `pbcopy`
- Finder integration uses `open -R`
