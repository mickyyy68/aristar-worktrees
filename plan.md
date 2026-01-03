# Module Reorganization Plan

> **TL;DR**: Reorganize the codebase into a modular structure with three main modules: `core` (shared utilities), `worktrees` (git worktree management), and `agent-manager` (AI agent orchestration). Each module has its own README.md files, `index.ts` for public exports, and feature-specific path aliases.

## Target Structure

```
src/
├── modules/
│   ├── core/
│   │   ├── README.md
│   │   ├── ui/                    # shadcn components
│   │   ├── lib/                   # utils, commands
│   │   ├── store/                 # base store, shared types
│   │   ├── components/            # Header, SettingsDialog, ThemeToggle
│   │   └── index.ts
│   │
│   ├── worktrees/
│   │   ├── README.md
│   │   ├── components/            # WorktreeCard, CreateWorktreeDialog, etc.
│   │   ├── lib/                   # branch-colors
│   │   ├── store/                 # worktree-specific state
│   │   └── index.ts
│   │
│   └── agent-manager/
│       ├── README.md
│       ├── components/
│       │   ├── chat/              # ChatView, ChatMessage, ChatInput
│       │   └── tools/             # ToolCallDisplay, ToolsSection, tool-config
│       ├── api/                   # opencode client, SSE handling
│       ├── store/                 # agent-manager state
│       └── index.ts
│
├── assets/                        # Static assets (stays at src level)
├── App.tsx
├── main.tsx
└── index.css
```

---

## Backlog

### Phase 0: Preparation

- [ ] **0.1** Review `opencode-panel.tsx` usage - check if it's imported anywhere in the codebase
- [ ] **0.2** If `opencode-panel.tsx` is unused, delete `src/components/opencode-panel.tsx`
- [ ] **0.3** Create `plan.md` tracking document (this file)

---

### Phase 1: Setup Module Structure

#### 1.1 Create Folder Structure
- [ ] **1.1.1** Create directory `src/modules/`
- [ ] **1.1.2** Create directory `src/modules/core/`
- [ ] **1.1.3** Create directory `src/modules/core/ui/`
- [ ] **1.1.4** Create directory `src/modules/core/lib/`
- [ ] **1.1.5** Create directory `src/modules/core/store/`
- [ ] **1.1.6** Create directory `src/modules/core/components/`
- [ ] **1.1.7** Create directory `src/modules/worktrees/`
- [ ] **1.1.8** Create directory `src/modules/worktrees/components/`
- [ ] **1.1.9** Create directory `src/modules/worktrees/lib/`
- [ ] **1.1.10** Create directory `src/modules/worktrees/store/`
- [ ] **1.1.11** Create directory `src/modules/agent-manager/`
- [ ] **1.1.12** Create directory `src/modules/agent-manager/components/`
- [ ] **1.1.13** Create directory `src/modules/agent-manager/components/chat/`
- [ ] **1.1.14** Create directory `src/modules/agent-manager/components/tools/`
- [ ] **1.1.15** Create directory `src/modules/agent-manager/api/`
- [ ] **1.1.16** Create directory `src/modules/agent-manager/store/`

#### 1.2 Configure Path Aliases
- [ ] **1.2.1** Update `vite.config.ts` - add alias `@core` pointing to `src/modules/core`
- [ ] **1.2.2** Update `vite.config.ts` - add alias `@worktrees` pointing to `src/modules/worktrees`
- [ ] **1.2.3** Update `vite.config.ts` - add alias `@agent-manager` pointing to `src/modules/agent-manager`
- [ ] **1.2.4** Update `tsconfig.json` - add path mapping for `@core/*`
- [ ] **1.2.5** Update `tsconfig.json` - add path mapping for `@worktrees/*`
- [ ] **1.2.6** Update `tsconfig.json` - add path mapping for `@agent-manager/*`
- [ ] **1.2.7** Update `tsconfig.app.json` - add path mapping for `@core/*`
- [ ] **1.2.8** Update `tsconfig.app.json` - add path mapping for `@worktrees/*`
- [ ] **1.2.9** Update `tsconfig.app.json` - add path mapping for `@agent-manager/*`

---

### Phase 2: Core Module

#### 2.1 Move UI Components
- [ ] **2.1.1** Move `src/components/ui/button.tsx` → `src/modules/core/ui/button.tsx`
- [ ] **2.1.2** Move `src/components/ui/card.tsx` → `src/modules/core/ui/card.tsx`
- [ ] **2.1.3** Move `src/components/ui/dialog.tsx` → `src/modules/core/ui/dialog.tsx`
- [ ] **2.1.4** Move `src/components/ui/dropdown-menu.tsx` → `src/modules/core/ui/dropdown-menu.tsx`
- [ ] **2.1.5** Move `src/components/ui/input.tsx` → `src/modules/core/ui/input.tsx`
- [ ] **2.1.6** Move `src/components/ui/label.tsx` → `src/modules/core/ui/label.tsx`
- [ ] **2.1.7** Move `src/components/ui/scroll-area.tsx` → `src/modules/core/ui/scroll-area.tsx`
- [ ] **2.1.8** Move `src/components/ui/select.tsx` → `src/modules/core/ui/select.tsx`
- [ ] **2.1.9** Move `src/components/ui/separator.tsx` → `src/modules/core/ui/separator.tsx`
- [ ] **2.1.10** Move `src/components/ui/switch.tsx` → `src/modules/core/ui/switch.tsx`
- [ ] **2.1.11** Move `src/components/ui/textarea.tsx` → `src/modules/core/ui/textarea.tsx`
- [ ] **2.1.12** Move `src/components/ui/tooltip.tsx` → `src/modules/core/ui/tooltip.tsx`
- [ ] **2.1.13** Move `src/components/ui/app-icon.tsx` → `src/modules/core/ui/app-icon.tsx`
- [ ] **2.1.14** Move `src/components/ui/markdown-renderer.tsx` → `src/modules/core/ui/markdown-renderer.tsx`
- [ ] **2.1.15** Create `src/modules/core/ui/index.ts` - export all UI components

#### 2.2 Move Core Lib
- [ ] **2.2.1** Move `src/lib/utils.ts` → `src/modules/core/lib/utils.ts`
- [ ] **2.2.2** Move `src/lib/commands.ts` → `src/modules/core/lib/commands.ts`
- [ ] **2.2.3** Create `src/modules/core/lib/index.ts` - export `cn`, `commands`

#### 2.3 Setup Core Store
- [ ] **2.3.1** Create `src/modules/core/store/types.ts` - extract shared types:
  - `TerminalApp`
  - `EditorApp`
  - `ToolOutputVisibility`
  - `ToolDisplaySettings`
  - `AppSettings`
  - `ActiveView`
- [ ] **2.3.2** Create `src/modules/core/store/app-store.ts` - extract app-wide state:
  - `settings`
  - `activeView`
  - `setSettings`
  - `setActiveView`
  - Persistence setup
- [ ] **2.3.3** Create `src/modules/core/store/index.ts` - export store and types

#### 2.4 Move Core Components
- [ ] **2.4.1** Move `src/components/header.tsx` → `src/modules/core/components/header.tsx`
- [ ] **2.4.2** Move `src/components/settings-dialog.tsx` → `src/modules/core/components/settings-dialog.tsx`
- [ ] **2.4.3** Move `src/components/theme-toggle.tsx` → `src/modules/core/components/theme-toggle.tsx`
- [ ] **2.4.4** Create `src/modules/core/components/index.ts` - export components

#### 2.5 Core Module Index & Documentation
- [ ] **2.5.1** Create `src/modules/core/index.ts` - main module exports:
  - Re-export from `./ui`
  - Re-export from `./lib`
  - Re-export from `./store`
  - Re-export from `./components`
- [ ] **2.5.2** Create `src/modules/core/README.md` with:
  - TL;DR
  - Overview
  - Structure
  - Key exports
  - Dependencies (external only)
- [ ] **2.5.3** Create `src/modules/core/ui/README.md` - document all UI components

#### 2.6 Update Core Imports
- [ ] **2.6.1** Update imports in `src/modules/core/ui/*.tsx` - use relative imports within module
- [ ] **2.6.2** Update imports in `src/modules/core/components/*.tsx` - use `@core/ui`, `@core/lib`
- [ ] **2.6.3** Update imports in `src/modules/core/store/*.ts` - use relative imports

---

### Phase 3: Worktrees Module

#### 3.1 Move Worktree Components
- [ ] **3.1.1** Move `src/components/worktree-card.tsx` → `src/modules/worktrees/components/worktree-card.tsx`
- [ ] **3.1.2** Move `src/components/create-worktree-dialog.tsx` → `src/modules/worktrees/components/create-worktree-dialog.tsx`
- [ ] **3.1.3** Move `src/components/rename-dialog.tsx` → `src/modules/worktrees/components/rename-dialog.tsx`
- [ ] **3.1.4** Move `src/components/repository-sidebar.tsx` → `src/modules/worktrees/components/repository-sidebar.tsx`
- [ ] **3.1.5** Create `src/modules/worktrees/components/index.ts` - export all components

#### 3.2 Move Worktree Lib
- [ ] **3.2.1** Move `src/lib/branch-colors.ts` → `src/modules/worktrees/lib/branch-colors.ts`
- [ ] **3.2.2** Create `src/modules/worktrees/lib/index.ts` - export branch color utilities

#### 3.3 Setup Worktree Store
- [ ] **3.3.1** Create `src/modules/worktrees/store/types.ts` - extract worktree types:
  - `WorktreeMetadata`
  - `Repository`
  - `CreateWorktreeRequest`
  - `SourceType`
  - `BranchInfo`
  - `CommitInfo`
- [ ] **3.3.2** Create `src/modules/worktrees/store/worktree-store.ts` - extract worktree state from `use-app-store.ts`:
  - `repositories`
  - `selectedRepositoryId`
  - `isLoading`
  - `error`
  - `loadRepositories`
  - `addRepository`
  - `removeRepository`
  - `refreshRepository`
  - `createWorktree`
  - `removeWorktree`
  - `renameWorktree`
  - `lockWorktree`
  - `unlockWorktree`
  - `openInTerminal`
  - `openInEditor`
  - `revealInFinder`
  - `copyToClipboard`
  - `clearError`
- [ ] **3.3.3** Create `src/modules/worktrees/store/index.ts` - export store and types

#### 3.4 Worktree Module Index & Documentation
- [ ] **3.4.1** Create `src/modules/worktrees/index.ts` - main module exports
- [ ] **3.4.2** Create `src/modules/worktrees/README.md` with:
  - TL;DR
  - Overview
  - Structure
  - Key exports
  - Dependencies
  - Rust backend commands reference
- [ ] **3.4.3** Create `src/modules/worktrees/components/README.md` - document components

#### 3.5 Update Worktree Imports
- [ ] **3.5.1** Update imports in `src/modules/worktrees/components/*.tsx` - use `@core/*` and relative imports
- [ ] **3.5.2** Update imports in `src/modules/worktrees/store/*.ts` - use `@core/*` for commands
- [ ] **3.5.3** Update imports in `src/modules/worktrees/lib/*.ts` - use relative imports

---

### Phase 4: Agent Manager Module

#### 4.1 Move Agent Manager API
- [ ] **4.1.1** Move `src/lib/opencode.ts` → `src/modules/agent-manager/api/opencode.ts`
- [ ] **4.1.2** Move `src/lib/use-agent-sse.ts` → `src/modules/agent-manager/api/use-agent-sse.ts`
- [ ] **4.1.3** Create `src/modules/agent-manager/api/index.ts` - export API utilities

#### 4.2 Move Agent Manager Store
- [ ] **4.2.1** Move `src/store/types/agent-manager.ts` → `src/modules/agent-manager/store/types.ts`
- [ ] **4.2.2** Move `src/store/agent-manager-store.ts` → `src/modules/agent-manager/store/agent-manager-store.ts`
- [ ] **4.2.3** Update store imports to use `@core/*` for shared types
- [ ] **4.2.4** Create `src/modules/agent-manager/store/index.ts` - export store and types

#### 4.3 Move Agent Manager Chat Components
- [ ] **4.3.1** Move `src/components/agent-manager/chat-view.tsx` → `src/modules/agent-manager/components/chat/chat-view.tsx`
- [ ] **4.3.2** Move `src/components/agent-manager/chat-message.tsx` → `src/modules/agent-manager/components/chat/chat-message.tsx`
- [ ] **4.3.3** Move `src/components/agent-manager/chat-input.tsx` → `src/modules/agent-manager/components/chat/chat-input.tsx`
- [ ] **4.3.4** Create `src/modules/agent-manager/components/chat/index.ts` - export chat components

#### 4.4 Move Agent Manager Tool Components
- [ ] **4.4.1** Move `src/components/agent-manager/tool-config.ts` → `src/modules/agent-manager/components/tools/tool-config.ts`
- [ ] **4.4.2** Move `src/components/agent-manager/tool-call-display.tsx` → `src/modules/agent-manager/components/tools/tool-call-display.tsx`
- [ ] **4.4.3** Move `src/components/agent-manager/tools-section.tsx` → `src/modules/agent-manager/components/tools/tools-section.tsx`
- [ ] **4.4.4** Create `src/modules/agent-manager/components/tools/index.ts` - export tool components

#### 4.5 Move Agent Manager Other Components
- [ ] **4.5.1** Move `src/components/agent-manager/agent-manager-view.tsx` → `src/modules/agent-manager/components/agent-manager-view.tsx`
- [ ] **4.5.2** Move `src/components/agent-manager/agent-tabs.tsx` → `src/modules/agent-manager/components/agent-tabs.tsx`
- [ ] **4.5.3** Move `src/components/agent-manager/agent-actions.tsx` → `src/modules/agent-manager/components/agent-actions.tsx`
- [ ] **4.5.4** Move `src/components/agent-manager/agent-type-selector.tsx` → `src/modules/agent-manager/components/agent-type-selector.tsx`
- [ ] **4.5.5** Move `src/components/agent-manager/create-task-dialog.tsx` → `src/modules/agent-manager/components/create-task-dialog.tsx`
- [ ] **4.5.6** Move `src/components/agent-manager/model-selector.tsx` → `src/modules/agent-manager/components/model-selector.tsx`
- [ ] **4.5.7** Move `src/components/agent-manager/source-selector.tsx` → `src/modules/agent-manager/components/source-selector.tsx`
- [ ] **4.5.8** Move `src/components/agent-manager/status-badge.tsx` → `src/modules/agent-manager/components/status-badge.tsx`
- [ ] **4.5.9** Move `src/components/agent-manager/task-empty-state.tsx` → `src/modules/agent-manager/components/task-empty-state.tsx`
- [ ] **4.5.10** Move `src/components/agent-manager/task-list-sidebar.tsx` → `src/modules/agent-manager/components/task-list-sidebar.tsx`
- [ ] **4.5.11** Create `src/modules/agent-manager/components/index.ts` - export all components

#### 4.6 Agent Manager Module Index & Documentation
- [ ] **4.6.1** Create `src/modules/agent-manager/index.ts` - main module exports
- [ ] **4.6.2** Create `src/modules/agent-manager/README.md` with:
  - TL;DR
  - Overview
  - Structure
  - Key exports
  - Dependencies
  - SSE event flow explanation
  - Tool configuration reference
- [ ] **4.6.3** Create `src/modules/agent-manager/components/README.md` - component overview
- [ ] **4.6.4** Create `src/modules/agent-manager/components/chat/README.md` - chat system documentation
- [ ] **4.6.5** Create `src/modules/agent-manager/components/tools/README.md` - tool display documentation:
  - Tool icons and colors table
  - Settings options
  - How to add new tools
- [ ] **4.6.6** Create `src/modules/agent-manager/api/README.md` - API documentation:
  - OpenCode client usage
  - SSE event handling
  - Event types reference

#### 4.7 Update Agent Manager Imports
- [ ] **4.7.1** Update imports in `src/modules/agent-manager/api/*.ts` - use `@core/*` and relative imports
- [ ] **4.7.2** Update imports in `src/modules/agent-manager/store/*.ts` - use `@core/*` and relative imports
- [ ] **4.7.3** Update imports in `src/modules/agent-manager/components/chat/*.tsx` - use `@core/*`, `@agent-manager/*`
- [ ] **4.7.4** Update imports in `src/modules/agent-manager/components/tools/*.tsx` - use `@core/*`, `@agent-manager/*`
- [ ] **4.7.5** Update imports in `src/modules/agent-manager/components/*.tsx` - use `@core/*`, `@agent-manager/*`

---

### Phase 5: Update App Entry Points

#### 5.1 Update App.tsx
- [ ] **5.1.1** Update imports in `src/App.tsx` to use:
  - `@core/*` for Header, ThemeToggle, SettingsDialog
  - `@worktrees/*` for WorktreeCard, RepositorySidebar, etc.
  - `@agent-manager/*` for AgentManagerView
- [ ] **5.1.2** Update store imports to use new module stores

#### 5.2 Update main.tsx
- [ ] **5.2.1** Review and update any imports in `src/main.tsx` if needed

---

### Phase 6: Cleanup Old Structure

#### 6.1 Remove Old Directories
- [ ] **6.1.1** Delete `src/components/ui/` (after verifying all files moved)
- [ ] **6.1.2** Delete `src/components/agent-manager/` (after verifying all files moved)
- [ ] **6.1.3** Delete `src/components/` directory if empty (keep only if has remaining files)
- [ ] **6.1.4** Delete `src/lib/` directory (after verifying all files moved)
- [ ] **6.1.5** Delete `src/store/types/` directory (after verifying all files moved)
- [ ] **6.1.6** Delete `src/store/` directory (after verifying all files moved)

#### 6.2 Remove Old Store File
- [ ] **6.2.1** Delete `src/store/use-app-store.ts` (after store splitting is complete)
- [ ] **6.2.2** Delete `src/store/types.ts` (after types are distributed to modules)

---

### Phase 7: Verification & Testing

#### 7.1 Type Checking
- [ ] **7.1.1** Run `bun run tsc` - fix any type errors
- [ ] **7.1.2** Verify no unused imports/exports

#### 7.2 Linting
- [ ] **7.2.1** Run `bun run lint` - fix any lint errors
- [ ] **7.2.2** Verify import order follows AGENTS.md guidelines

#### 7.3 Runtime Testing
- [ ] **7.3.1** Run `bun run tauri dev` - verify app starts
- [ ] **7.3.2** Test worktree creation flow
- [ ] **7.3.3** Test worktree deletion flow
- [ ] **7.3.4** Test opening worktree in terminal
- [ ] **7.3.5** Test opening worktree in editor
- [ ] **7.3.6** Test agent manager view navigation
- [ ] **7.3.7** Test creating a new task
- [ ] **7.3.8** Test agent chat interaction
- [ ] **7.3.9** Test tool display (expand/collapse)
- [ ] **7.3.10** Test settings dialog (all sections)

#### 7.4 Rust Backend
- [ ] **7.4.1** Run `cargo test` in `src-tauri/` - verify all tests pass
- [ ] **7.4.2** Run `cargo clippy` - verify no warnings

---

### Phase 8: Documentation Updates

#### 8.1 Update ARCHITECTURE.md
- [ ] **8.1.1** Update `docs/ARCHITECTURE.md` - add Module System section
- [ ] **8.1.2** Update `docs/ARCHITECTURE.md` - add Agent Manager section
- [ ] **8.1.3** Update `docs/ARCHITECTURE.md` - update Component Hierarchy diagram
- [ ] **8.1.4** Update `docs/ARCHITECTURE.md` - update project structure diagram

#### 8.2 Update AGENTS.md
- [ ] **8.2.1** Update `AGENTS.md` - update Project Structure section
- [ ] **8.2.2** Update `AGENTS.md` - add Module Import Guidelines
- [ ] **8.2.3** Update `AGENTS.md` - update import order examples with new aliases

#### 8.3 Rust Backend Documentation (Future Task)
- [ ] **8.3.1** Create `src-tauri/src/commands/README.md` - placeholder with TODO
- [ ] **8.3.2** Document all Tauri commands
- [ ] **8.3.3** Document state management
- [ ] **8.3.4** Document worktree operations
- [ ] **8.3.5** Document OpenCode manager
- [ ] **8.3.6** Document task manager

---

### Phase 9: Final Review

- [ ] **9.1** Review all README.md files for completeness
- [ ] **9.2** Verify all index.ts exports are correct
- [ ] **9.3** Verify path aliases work correctly
- [ ] **9.4** Run full build `bun run build`
- [ ] **9.5** Run `bun run tauri build` (optional - production build)
- [ ] **9.6** Delete this `plan.md` file (or move to docs/ as historical reference)

---

## Notes

- Each task is designed to be small and isolated
- Tasks within a phase can often be parallelized
- Always run typecheck after moving files to catch import issues early
- Keep the app runnable at each phase boundary (end of Phase 2, 3, 4, etc.)
- If a task fails, fix it before proceeding to dependent tasks

## Estimated Effort

- **Phase 0-1**: ~30 minutes (setup)
- **Phase 2**: ~1-2 hours (core module)
- **Phase 3**: ~1 hour (worktrees module)
- **Phase 4**: ~1-2 hours (agent-manager module)
- **Phase 5-6**: ~30 minutes (app updates, cleanup)
- **Phase 7**: ~1 hour (verification)
- **Phase 8**: ~1-2 hours (documentation)
- **Phase 9**: ~30 minutes (final review)

**Total**: ~7-10 hours
