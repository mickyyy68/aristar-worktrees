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
cargo test worktree_unit_tests
cargo test state_tests
cargo test worktree_integration_tests

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
├── components/          # React components
│   ├── ui/              # shadcn/ui base components (don't modify)
│   ├── agent-manager/   # Agent Manager feature components
│   │   ├── tool-config.ts        # Tool icons/colors configuration
│   │   ├── tool-call-display.tsx # Individual tool display
│   │   ├── tools-section.tsx     # Tool grouping wrapper
│   │   └── *.tsx                 # Other agent manager components
│   └── *.tsx            # App components
├── lib/                 # Utilities and helpers
├── store/               # Zustand state management
│   └── types/           # Type definitions by feature
└── assets/              # Static assets

src-tauri/src/           # Rust backend
├── commands/            # Tauri command handlers
│   ├── mod.rs           # Command definitions
│   ├── worktree.rs      # Git operations
│   └── tests/           # Test modules
└── main.rs              # App entry point
```

## Code Style Guidelines

### TypeScript/React

**Imports** - Order imports as follows:
1. React imports (`import { useState } from 'react'`)
2. External libraries (`import { open } from '@tauri-apps/plugin-dialog'`)
3. UI components (`import { Button } from '@/components/ui/button'`)
4. App components (`import { Header } from '@/components/header'`)
5. Store/hooks (`import { useAppStore } from '@/store/use-app-store'`)
6. Utils (`import { cn } from '@/lib/utils'`)
7. Types (`import type { WorktreeMetadata } from '@/store/types'`)

**Path Aliases** - Always use `@/` alias for imports from `src/`:
```typescript
// Good
import { Button } from '@/components/ui/button';

// Bad
import { Button } from '../../components/ui/button';
```

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
- Place tests in `src/commands/tests/`
- Use `TestRepo` helper for git repository fixtures
- Name tests descriptively: `test_<function>_<scenario>`

## UI Components

Use **shadcn/ui** components from `src/components/ui/`. These are pre-configured with Radix UI and Tailwind CSS.

Available components: `Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Label`, `ScrollArea`, `Select`, `Separator`, `Switch`, `Textarea`, `Tooltip`

**Styling**: Use Tailwind CSS classes. Use `cn()` utility for conditional classes:
```typescript
import { cn } from '@/lib/utils';
<div className={cn('base-class', condition && 'conditional-class')} />
```

## State Management

Use Zustand store (`useAppStore`) for global state. Settings are persisted to localStorage.

```typescript
const { repositories, settings, addRepository } = useAppStore();
```

## Tauri Commands

Call Rust backend via `src/lib/commands.ts`:
```typescript
import * as commands from '@/lib/commands';
const repos = await commands.getRepositories();
```

## Important Notes

1. **macOS Only**: Terminal/editor integrations use macOS-specific commands
2. **No emojis** in code unless explicitly requested
3. **Strict TypeScript**: `noUnusedLocals` and `noUnusedParameters` enabled
4. **React 19**: Using latest React with new JSX transform
5. **Tailwind v4**: Uses CSS variables for theming
