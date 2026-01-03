# AGENTS.md - Coding Agent Guidelines

This document provides guidelines for AI coding agents working on the Aristar Worktrees codebase.

## Build & Development Commands

```bash
# Install dependencies
bun install

# Development
bun run dev              # Start Vite dev server only
bun run tauri dev        # Start full Tauri app in dev mode

# Build
bun run build            # Build frontend (tsc + vite)
bun run tauri build      # Build production app

# Linting & Type Checking
bun run lint             # Run ESLint
bun run tsc              # TypeScript type check (alias: bun run typecheck)
```

## Rust Commands

```bash
cd src-tauri

# Check compilation
cargo check

# Build
cargo build
cargo build --release

# Run all tests
cargo test

# Run a single test by name
cargo test test_get_repository_name_simple_path

# Run tests in a specific module
cargo test tests::worktrees::operations_tests
cargo test tests::worktrees::store_tests
cargo test tests::worktrees::integration_tests
cargo test tests::agent_manager::task_tests

# Run tests with output
cargo test -- --nocapture

# Format code
cargo fmt

# Lint
cargo clippy
```

## Project Structure

```
src/                     # React frontend (TypeScript)
├── modules/
│   ├── core/            # Shared infrastructure
│   │   ├── ui/          # shadcn/ui base components (don't modify)
│   │   ├── lib/         # utils.ts, commands.ts
│   │   ├── components/  # Header, SettingsDialog, ThemeToggle
│   │   └── index.ts     # Public exports
│   ├── worktrees/       # Git worktree management
│   │   ├── components/  # WorktreeCard, CreateWorktreeDialog, etc.
│   │   ├── lib/         # branch-colors.ts
│   │   └── index.ts     # Public exports
│   └── agent-manager/   # AI agent orchestration
│       ├── components/
│       │   ├── chat/    # ChatView, ChatMessage, ChatInput
│       │   └── tools/   # ToolCallDisplay, ToolsSection, tool-config
│       ├── api/         # opencode.ts, use-agent-sse.ts
│       ├── store/       # agent-manager-store.ts, types.ts
│       └── index.ts     # Public exports
├── store/               # Shared Zustand state (use-app-store.ts, types.ts)
├── assets/              # Static assets
├── App.tsx
├── main.tsx
└── index.css

src-tauri/src/           # Rust backend
├── main.rs              # App entry point
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

## Code Style Guidelines

### TypeScript/React

**Imports** - Order imports as follows:
1. React imports (`import { useState } from 'react'`)
2. External libraries (`import { open } from '@tauri-apps/plugin-dialog'`)
3. UI components (`import { Button } from '@core/ui'`)
4. App components (`import { Header } from '@core/components'`)
5. Feature components (`import { WorktreeCard } from '@worktrees/components'`)
6. Store/hooks (`import { useAppStore } from '@/store/use-app-store'`)
7. Utils (`import { cn } from '@core/lib'`)
8. Types (`import type { WorktreeMetadata } from '@/store/types'`)

**Path Aliases** - Use feature-specific aliases for module imports:
```typescript
// Good - use feature aliases
import { Button } from '@core/ui';
import { cn } from '@core/lib';
import { WorktreeCard } from '@worktrees/components';
import { ChatView } from '@agent-manager/components/chat';

// Good - use @/ for shared store
import { useAppStore } from '@/store/use-app-store';

// Bad - relative imports
import { Button } from '../../modules/core/ui/button';
```

**Available Path Aliases**:
- `@core/*` -> `src/modules/core/*`
- `@worktrees/*` -> `src/modules/worktrees/*`
- `@agent-manager/*` -> `src/modules/agent-manager/*`
- `@/*` -> `src/*` (for shared store, assets, etc.)

**Component Structure**:
```typescript
'use client';  // Only if needed for client-side hooks

import { useState } from 'react';
// ... other imports

interface ComponentProps {
  prop: string;
}

export function Component({ prop }: ComponentProps) {
  const [state, setState] = useState('');
  // ... component logic
  return <div>{/* JSX */}</div>;
}
```

**Naming Conventions**:
- Components: PascalCase (`WorktreeCard`, `SettingsDialog`)
- Files: kebab-case (`worktree-card.tsx`, `settings-dialog.tsx`)
- Hooks: camelCase with `use` prefix (`useAppStore`)
- Types/Interfaces: PascalCase (`WorktreeMetadata`, `AppSettings`)
- Constants: SCREAMING_SNAKE_CASE for true constants

**Types**:
- Use `interface` for object shapes, `type` for unions/aliases
- Export types from `src/store/types.ts`
- Use `type` imports: `import type { X } from '...'`

### Rust

**Naming Conventions**:
- Functions: snake_case (`get_repository_name`)
- Structs: PascalCase (`WorktreeInfo`)
- Constants: SCREAMING_SNAKE_CASE
- Modules: snake_case

**Error Handling**:
- Tauri commands return `Result<T, String>`
- Use `.map_err(|e| e.to_string())?` for error conversion
- Provide descriptive error messages

**Command Pattern**:
```rust
#[tauri::command]
pub fn command_name(
    state: State<AppState>,
    param: String,
) -> Result<ReturnType, String> {
    // Implementation
    Ok(result)
}
```

**Testing**:
- Place tests in `src-tauri/src/tests/`
- Use `TestRepo` helper for git repository fixtures
- Name tests descriptively: `test_<function>_<scenario>`

## UI Components

Use **shadcn/ui** components from `src/modules/core/ui/`. These are pre-configured with Radix UI and Tailwind CSS.

Available components: `Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Label`, `ScrollArea`, `Select`, `Separator`, `Switch`, `Textarea`, `Tooltip`

**Styling**: Use Tailwind CSS classes. Use `cn()` utility for conditional classes:
```typescript
import { cn } from '@core/lib';
<div className={cn('base-class', condition && 'conditional-class')} />
```

## State Management

Use Zustand store (`useAppStore`) for global state. Settings are persisted to localStorage.

```typescript
const { repositories, settings, addRepository } = useAppStore();
```

## Tauri Commands

Call Rust backend via `src/modules/core/lib/commands.ts`:
```typescript
import * as commands from '@core/lib/commands';
const repos = await commands.getRepositories();
```

## Important Notes

1. **macOS Only**: Terminal/editor integrations use macOS-specific commands
2. **No emojis** in code unless explicitly requested
3. **Strict TypeScript**: `noUnusedLocals` and `noUnusedParameters` enabled
4. **React 19**: Using latest React with new JSX transform
5. **Tailwind v4**: Uses CSS variables for theming
