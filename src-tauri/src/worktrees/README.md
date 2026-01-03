# Worktrees Module

> **TL;DR**: Git worktree management including CRUD operations, branch/commit info, and external app integration (terminals, editors).

## Overview

The `worktrees` module handles all git worktree operations for the application. It provides:

- **Worktree Operations**: Create, remove, rename, lock/unlock worktrees
- **Repository Management**: Add, remove, refresh repositories
- **Git Information**: Branch listing, commit history
- **External Apps**: Open worktrees in terminals and editors
- **State Management**: Persistent storage of repositories and settings

## File Structure

```
worktrees/
├── mod.rs           # Module exports
├── types.rs         # Data structures (WorktreeInfo, Repository, etc.)
├── operations.rs    # Git worktree operations (create, remove, etc.)
├── external_apps.rs # Terminal/editor integration
├── store.rs         # State management (AppState)
├── commands.rs      # Tauri commands (frontend API)
└── README.md        # This file
```

## Types

### `WorktreeInfo`

Information about a single git worktree.

```rust
pub struct WorktreeInfo {
    pub id: String,                    // UUID
    pub name: String,                  // Display name
    pub path: String,                  // Absolute path
    pub branch: Option<String>,        // Current branch (None if detached)
    pub commit: Option<String>,        // Current commit hash
    pub is_main: bool,                 // Is this the main worktree?
    pub is_locked: bool,               // Is worktree locked?
    pub lock_reason: Option<String>,   // Lock reason message
    pub startup_script: Option<String>,// Setup script content
    pub script_executed: bool,         // Was script executed?
    pub created_at: i64,               // Timestamp (millis)
}
```

### `Repository`

A git repository with its worktrees.

```rust
pub struct Repository {
    pub id: String,                    // UUID
    pub path: String,                  // Absolute path to main repo
    pub name: String,                  // Repository name
    pub worktrees: Vec<WorktreeInfo>,  // All worktrees
    pub last_scanned: i64,             // Last refresh timestamp
}
```

### `BranchInfo`

Branch information for a repository.

```rust
pub struct BranchInfo {
    pub name: String,       // Branch name
    pub is_current: bool,   // Is this the checked-out branch?
    pub is_remote: bool,    // Is this a remote tracking branch?
}
```

### `CommitInfo`

Commit information (camelCase for frontend).

```rust
pub struct CommitInfo {
    pub hash: String,       // Full commit hash
    pub short_hash: String, // Short hash (7 chars)
    pub message: String,    // Commit message
    pub author: String,     // Author name
    pub date: i64,          // Timestamp (Unix seconds)
}
```

### `StoreData`

Persistent storage structure.

```rust
pub struct StoreData {
    pub repositories: Vec<Repository>,
    pub settings: AppSettings,
}
```

## State Management

### `AppState`

Thread-safe wrapper for the store, managed by Tauri.

```rust
pub struct AppState {
    pub store: Mutex<StoreData>,
}

impl AppState {
    pub fn save(&self) -> Result<(), String>  // Persist to disk
}

pub fn init_store() -> AppState  // Load from disk or create default
```

**Usage in main.rs:**
```rust
tauri::Builder::default()
    .manage(worktrees::init_store())
    // ...
```

## Tauri Commands

All commands are available to the frontend via `invoke()`.

### Repository Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_repositories` | - | `Vec<Repository>` | List all repositories |
| `add_repository` | `path: String` | `Repository` | Add a new repository |
| `remove_repository` | `id: String` | `()` | Remove repository by ID |
| `refresh_repository` | `id: String` | `Repository` | Rescan worktrees |

### Worktree Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `list_worktrees` | `repo_path: String` | `Vec<WorktreeInfo>` | List worktrees for a repo |
| `create_worktree` | `repo_path, name, branch?, commit?, startup_script?, execute_script` | `WorktreeInfo` | Create new worktree |
| `remove_worktree` | `path, force, delete_branch` | `()` | Remove worktree |
| `rename_worktree` | `old_path, new_name` | `WorktreeInfo` | Rename worktree |
| `lock_worktree` | `path, reason?` | `()` | Lock worktree |
| `unlock_worktree` | `path` | `()` | Unlock worktree |

### Git Information Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_branches` | `repo_path: String` | `Vec<BranchInfo>` | List all branches |
| `get_commits` | `repo_path, limit?` | `Vec<CommitInfo>` | Get recent commits (default 50) |

### External App Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `open_in_terminal` | `path, app, custom_command?` | `()` | Open path in terminal |
| `open_in_editor` | `path, app, custom_command?` | `()` | Open path in editor |
| `reveal_in_finder` | `path` | `()` | Show in Finder |
| `copy_to_clipboard` | `text` | `()` | Copy text to clipboard |

## Operations (`operations.rs`)

Low-level git worktree operations.

| Function | Description |
|----------|-------------|
| `is_git_repository(path)` | Check if path is a git repo |
| `get_repository_name(path)` | Extract repo name from path |
| `get_repo_hash(repo_path)` | 8-char hash for worktree storage |
| `get_worktree_base_for_repo(repo_path)` | Get `~/.aristar-worktrees/{hash}` |
| `list_worktrees(repo_path)` | Parse `git worktree list --porcelain` |
| `create_worktree(...)` | Run `git worktree add` |
| `remove_worktree(path, force, delete_branch)` | Run `git worktree remove` |
| `rename_worktree(old_path, new_name)` | Run `git worktree move` |
| `lock_worktree(path, reason?)` | Run `git worktree lock` |
| `unlock_worktree(path)` | Run `git worktree unlock` |
| `get_branches(repo_path)` | Parse `git branch -a` |
| `get_commits(repo_path, limit)` | Parse `git log` |
| `create_worktree_at_path(repo_path, dest_path, ref?)` | Create worktree at custom location |

## External Apps (`external_apps.rs`)

### Supported Terminals

| App ID | Application | Method |
|--------|-------------|--------|
| `terminal` | macOS Terminal | AppleScript |
| `iterm` | iTerm2 | AppleScript |
| `ghostty` | Ghostty | `open -a` |
| `alacritty` | Alacritty | IPC or spawn |
| `kitty` | Kitty | `--single-instance` |
| `warp` | Warp | `open -a` |
| `custom` | Custom | User-provided command |

### Supported Editors

| App ID | Application | Method |
|--------|-------------|--------|
| `vscode` | VS Code | `open -a` |
| `cursor` | Cursor | `open -a` |
| `zed` | Zed | `open -a` |
| `antigravity` | Antigravity | `open -a` |
| `custom` | Custom | User-provided command |

## Worktree Storage

Worktrees are stored in `~/.aristar-worktrees/{hash}/`:

```
~/.aristar-worktrees/
├── store.json                    # Repository and settings data
├── a1b2c3d4/                      # Hash of /path/to/repo
│   ├── .aristar-repo-info.json   # Original repo path
│   ├── feature-branch/           # Worktree for feature-branch
│   └── bugfix/                   # Worktree for bugfix branch
└── e5f6g7h8/                      # Hash of another repo
    └── ...
```

## Error Handling

All operations return `Result<T, String>`:
- Git command failures include stderr output
- File operations include OS error messages
- State operations handle mutex poisoning

## Example Usage (Frontend)

```typescript
import { invoke } from '@tauri-apps/api/core';

// Add a repository
const repo = await invoke('add_repository', { path: '/path/to/repo' });

// Create a worktree
const worktree = await invoke('create_worktree', {
  repoPath: repo.path,
  name: 'feature-x',
  branch: 'feature-x',
  startupScript: '#!/bin/bash\nnpm install',
  executeScript: true,
});

// Open in terminal
await invoke('open_in_terminal', {
  path: worktree.path,
  app: 'ghostty',
});
```
