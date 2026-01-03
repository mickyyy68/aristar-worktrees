# AGENTS.md - Coding Agent Guidelines

This document provides guidelines for AI coding agents working on the Aristar Worktrees codebase.

## Critical Guidelines

**MUST**: Keep documentation updated when making changes:
- Update **AGENTS.md** when changing build commands, project structure, or conventions
- Update the **README.md** of any module you modify (structure, APIs, types, etc.)

**MUST**: Read the README.md of the module you're working on before making changes:
- `src-tauri/README.md` - Rust backend overview
- `src-tauri/src/core/README.md` - Core module (persistence, system ops)
- `src-tauri/src/worktrees/README.md` - Worktrees module
- `src-tauri/src/agent_manager/README.md` - Agent manager module
- `src-tauri/src/tests/README.md` - Testing conventions
- `src/modules/core/README.md` - Frontend core (UI, utils, commands)
- `src/modules/worktrees/README.md` - Frontend worktrees
- `src/modules/agent-manager/README.md` - Frontend agent manager

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

## Path Aliases (TypeScript)

```typescript
import { Button } from '@core/ui';
import { cn } from '@core/lib';
import { WorktreeCard } from '@worktrees/components';
import { ChatView } from '@agent-manager/components/chat';
import { useAppStore } from '@/store/use-app-store';
```

| Alias | Target |
|-------|--------|
| `@core/*` | `src/modules/core/*` |
| `@worktrees/*` | `src/modules/worktrees/*` |
| `@agent-manager/*` | `src/modules/agent-manager/*` |
| `@/*` | `src/*` |

## Code Style Quick Reference

### TypeScript
- Components: PascalCase (`WorktreeCard`)
- Files: kebab-case (`worktree-card.tsx`)
- Use `interface` for objects, `type` for unions
- Use `import type` for type-only imports

### Rust
- Functions: snake_case (`get_repository_name`)
- Structs: PascalCase (`WorktreeInfo`)
- Tauri commands return `Result<T, String>`
- Tests go in `src-tauri/src/tests/`

## Important Notes

1. **macOS Only**: Terminal/editor integrations use macOS-specific commands
2. **No emojis** in code unless explicitly requested
3. **Strict TypeScript**: `noUnusedLocals` and `noUnusedParameters` enabled
4. **React 19**: Using latest React with new JSX transform
5. **Tailwind v4**: Uses CSS variables for theming
