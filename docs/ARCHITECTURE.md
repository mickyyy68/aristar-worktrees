# Architecture Documentation

This document provides a detailed overview of the Aristar Worktrees architecture.

## Overview

Aristar Worktrees is a desktop application built with Tauri, combining a React frontend with a Rust backend. The application manages Git worktrees across multiple repositories and provides an AI agent manager for orchestrating coding tasks.

## Frontend Architecture

### Modular Structure

The frontend is organized into feature-based modules under `src/modules/`:

```
src/
├── modules/
│   ├── core/                    # Shared infrastructure
│   │   ├── ui/                  # shadcn/ui components (14 files)
│   │   ├── lib/                 # utils, commands
│   │   ├── components/          # Header, SettingsDialog, ThemeToggle
│   │   └── index.ts             # Public exports
│   │
│   ├── worktrees/               # Git worktree management
│   │   ├── components/          # WorktreeCard, CreateWorktreeDialog, etc.
│   │   ├── lib/                 # branch-colors
│   │   └── index.ts             # Public exports
│   │
│   └── agent-manager/           # AI agent orchestration
│       ├── components/
│       │   ├── chat/            # ChatView, ChatMessage, ChatInput
│       │   └── tools/           # ToolCallDisplay, ToolsSection
│       ├── api/                 # OpenCode client, SSE handling
│       ├── store/               # Agent manager state
│       └── index.ts             # Public exports
│
├── store/                       # Shared app store
├── assets/                      # Static assets
├── App.tsx
├── main.tsx
└── index.css
```

### Path Aliases

The codebase uses feature-specific path aliases for clean imports:

| Alias | Target |
|-------|--------|
| `@core/*` | `src/modules/core/*` |
| `@worktrees/*` | `src/modules/worktrees/*` |
| `@agent-manager/*` | `src/modules/agent-manager/*` |
| `@/*` | `src/*` |

### Component Hierarchy

```
App.tsx
├── Header (core)
│   ├── SettingsDialog
│   └── ThemeToggle
├── RepositorySidebar (worktrees)
├── WorktreeCard (worktrees, multiple)
├── CreateWorktreeDialog (worktrees)
├── RenameDialog (worktrees)
└── OpenCodePanel (agent-manager)
    ├── TaskListSidebar
    ├── AgentManagerView
    │   ├── AgentTabs
    │   ├── ChatView
    │   │   ├── ChatMessage (multiple)
    │   │   └── ChatInput
    │   └── ToolsSection
    │       └── ToolCallDisplay (multiple)
    └── CreateTaskDialog
```

### State Management

The application uses **Zustand** for state management with the `persist` middleware for localStorage persistence.

**Shared Store** (`src/store/use-app-store.ts`):

```typescript
interface AppState {
  // Data
  repositories: Repository[];
  settings: AppSettings;
  selectedRepositoryId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSettings: (settings: Partial<AppSettings>) => void;
  setSelectedRepository: (id: string | null) => void;
  loadRepositories: () => Promise<void>;
  addRepository: (path: string) => Promise<void>;
  removeRepository: (id: string) => Promise<void>;
  refreshRepository: (id: string) => Promise<void>;
  createWorktree: (...) => Promise<void>;
  removeWorktree: (...) => Promise<void>;
  renameWorktree: (...) => Promise<void>;
  lockWorktree: (...) => Promise<void>;
  unlockWorktree: (...) => Promise<void>;
  openInTerminal: (path: string) => Promise<void>;
  openInEditor: (path: string) => Promise<void>;
  revealInFinder: (path: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  clearError: () => void;
}
```

**Agent Manager Store** (`src/modules/agent-manager/store/agent-manager-store.ts`):

```typescript
interface AgentManagerState {
  tasks: Task[];
  selectedTaskId: string | null;
  agents: Map<string, TaskAgent>;
  // Actions for task/agent management
}
```

### UI Components

All UI components are built using **shadcn/ui** (Radix UI + Tailwind CSS) and located in `src/modules/core/ui/`:

| Component | Purpose |
|-----------|---------|
| `Button` | Action buttons with variants |
| `Card` | Worktree cards |
| `Dialog` | Modal dialogs |
| `DropdownMenu` | Context menus |
| `Input` | Text inputs |
| `Label` | Form labels |
| `ScrollArea` | Scrollable containers |
| `Select` | Dropdown selects |
| `Separator` | Visual dividers |
| `Switch` | Toggle switches |
| `Textarea` | Multi-line inputs |
| `Tooltip` | Hover tooltips |
| `MarkdownRenderer` | Markdown content display |
| `AppIcon` | Application icons |

### Theming

The application supports three theme modes:
- **Light**: Light color scheme
- **Dark**: Dark color scheme
- **System**: Follows OS preference

Theming is implemented via CSS variables in `index.css` with Tailwind CSS v4.

### Branch Color System

Branches are color-coded for visual organization (`src/modules/worktrees/lib/branch-colors.ts`):

| Pattern | Color Index |
|---------|-------------|
| `main`, `master` | 0 (chart-1) |
| `develop`, `development` | 1 (chart-2) |
| `feature/*` | 2 (chart-3) |
| `fix/*`, `bugfix/*`, `hotfix/*` | 3 (chart-4) |
| `release/*` | 4 (chart-5) |
| Other branches | Hash-based (0-4) |

## Backend Architecture

### Module Structure

```
src-tauri/src/
├── main.rs              # Application entry point
├── lib.rs               # Library exports
├── core/                # Shared infrastructure
│   ├── mod.rs           # Module exports
│   ├── persistence.rs   # Store load/save utilities
│   ├── system.rs        # System operations (clipboard, finder)
│   └── types.rs         # Shared types (AppSettings)
├── worktrees/           # Worktree management
│   ├── mod.rs           # Module exports
│   ├── types.rs         # WorktreeInfo, Repository, etc.
│   ├── operations.rs    # Git worktree operations
│   ├── external_apps.rs # Terminal/editor integration
│   ├── store.rs         # Worktree state (AppState)
│   └── commands.rs      # Tauri commands
├── agent_manager/       # Agent manager
│   ├── mod.rs           # Module exports
│   ├── types.rs         # Task, TaskAgent, etc.
│   ├── task_operations.rs # Task CRUD
│   ├── agent_operations.rs # Agent management
│   ├── opencode.rs      # OpenCode process manager
│   ├── store.rs         # Task state (TaskManagerState)
│   └── commands.rs      # Tauri commands
└── tests/               # Centralized tests
    ├── mod.rs           # Test module exports
    ├── helpers.rs       # Test utilities (TestRepo)
    ├── worktrees/       # Worktree tests
    └── agent_manager/   # Agent manager tests
```

### Core Module (`core/`)

Shared infrastructure used by all feature modules:
- **persistence.rs**: Generic load/save functions for JSON stores
- **system.rs**: System operations (clipboard, Finder reveal)
- **types.rs**: Shared types like `AppSettings`

### Worktrees Module (`worktrees/`)

Git worktree management:
- **types.rs**: `WorktreeInfo`, `Repository`, `StoreData`
- **operations.rs**: Git worktree operations via shell commands
- **external_apps.rs**: Terminal/editor integration
- **store.rs**: `AppState` with repository data
- **commands.rs**: Tauri commands exposed to frontend

### Agent Manager Module (`agent_manager/`)

AI agent orchestration:
- **types.rs**: `Task`, `TaskAgent`, agent state types
- **task_operations.rs**: Task CRUD operations
- **agent_operations.rs**: Agent lifecycle management
- **opencode.rs**: OpenCode process manager
- **store.rs**: `TaskManagerState` for task data
- **commands.rs**: Tauri commands for agent management

### Worktree Operations (`worktrees/operations.rs`)

Core Git operations via shell commands:

| Function | Git Command |
|----------|-------------|
| `list_worktrees` | `git worktree list --porcelain` |
| `create_worktree` | `git worktree add` |
| `remove_worktree` | `git worktree remove` |
| `rename_worktree` | `git worktree move` |
| `lock_worktree` | `git worktree lock` |
| `unlock_worktree` | `git worktree unlock` |
| `get_branches` | `git branch -a` |
| `get_commits` | `git log` |

### External App Integration

The backend supports opening worktrees in external applications:

**Terminals:**
- Terminal.app (AppleScript)
- Ghostty (`open -a Ghostty`)
- Alacritty (IPC via `alacritty msg` or direct spawn)
- Kitty (direct spawn with `--single-instance`)
- iTerm2 (AppleScript)
- Warp (`open -a Warp`)
- Custom command

**Editors:**
- VS Code (`open -a "Visual Studio Code"`)
- Cursor (`open -a Cursor`)
- Zed (`open -a Zed`)
- Antigravity (`open -a Antigravity`)
- Custom command

### Worktree Storage Strategy

Worktrees are stored in a centralized location:

```
~/.aristar-worktrees/
├── store.json                    # Repository metadata
├── {repo-hash-1}/                # Worktrees for repo 1
│   ├── .aristar-repo-info.json   # Original repo path
│   ├── feature-foo/              # Worktree directory
│   └── bugfix-bar/               # Worktree directory
└── {repo-hash-2}/                # Worktrees for repo 2
    └── ...
```

The `repo-hash` is the first 8 hex characters of the SHA256 hash of the repository path.

## Data Flow

### Creating a Worktree

```
1. User clicks "New Worktree"
2. CreateWorktreeDialog opens
3. User fills form and submits
4. useAppStore.createWorktree() called
5. commands.createWorktree() invoked
6. Tauri command create_worktree executed
7. Rust calls worktree::create_worktree()
8. Git command: git worktree add ~/.aristar-worktrees/{hash}/{name} {branch}
9. Store updated and persisted
10. UI reflects new worktree
```

### Opening in Terminal

```
1. User clicks "Terminal" button
2. useAppStore.openInTerminal(path) called
3. Store retrieves settings.terminalApp
4. commands.openInTerminal(path, app, customCommand) invoked
5. Tauri command open_in_terminal executed
6. Rust matches terminal app and executes appropriate command
7. Terminal opens at worktree path
```

## Error Handling

### Frontend
- Errors stored in `useAppStore.error`
- Displayed in error bar at bottom of screen
- Cleared on next successful action

### Backend
- All Tauri commands return `Result<T, String>`
- Errors propagated to frontend as strings
- Logged to console for debugging

## Security Considerations

1. **File Access**: Limited to user's home directory and selected repositories
2. **Shell Commands**: Paths are escaped to prevent injection
3. **No Network**: Application is fully offline
4. **Permissions**: Uses Tauri's capability system (see `capabilities/default.json`)

## Performance Considerations

1. **Lazy Loading**: Worktrees loaded only when repository selected
2. **Optimistic Updates**: UI updated before backend confirmation
3. **Debounced Persistence**: Store saves batched to reduce I/O
4. **Single Instance Terminals**: Ghostty/Kitty reuse existing instances
