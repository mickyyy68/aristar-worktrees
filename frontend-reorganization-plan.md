# Frontend Module Reorganization Plan

> **TL;DR**: Reorganize the frontend codebase (`src/`) into a modular structure with three main modules: `core` (shared utilities), `worktrees` (git worktree management), and `agent-manager` (AI agent orchestration). Each module has its own README.md files, `index.ts` for public exports, and feature-specific path aliases.

## Status: COMPLETED

**Completed on:** January 3, 2026

### Verification Results
- TypeScript: Compiles successfully
- ESLint: Passes with no errors  
- Rust tests: 54 passed
- Frontend build: Successful

## Related Plans

- **[plan-2.md](./plan-2.md)** - Rust Backend Module Reorganization (can run in parallel)

## Final Structure

```
src/
├── modules/
│   ├── core/
│   │   ├── ui/                    # shadcn components (14 files)
│   │   ├── lib/                   # utils, commands
│   │   ├── components/            # Header, SettingsDialog, ThemeToggle
│   │   └── index.ts
│   │
│   ├── worktrees/
│   │   ├── components/            # WorktreeCard, CreateWorktreeDialog, etc.
│   │   ├── lib/                   # branch-colors
│   │   └── index.ts
│   │
│   └── agent-manager/
│       ├── components/
│       │   ├── chat/              # ChatView, ChatMessage, ChatInput
│       │   └── tools/             # ToolCallDisplay, ToolsSection, tool-config
│       ├── api/                   # opencode client, SSE handling
│       ├── store/                 # agent-manager state
│       └── index.ts
│
├── store/                         # Shared app store (use-app-store, types)
├── assets/                        # Static assets
├── App.tsx
├── main.tsx
└── index.css
```

### Path Aliases
- `@core/*` -> `src/modules/core/*`
- `@worktrees/*` -> `src/modules/worktrees/*`
- `@agent-manager/*` -> `src/modules/agent-manager/*`
- `@/*` -> `src/*` (unchanged)

---

## Completed Phases

### Phase 0: Preparation

- [x] **0.1** Review `opencode-panel.tsx` usage - IS used in App.tsx
- [x] **0.2** ~~If unused, delete~~ - CANCELLED (file is used, moved to agent-manager)
- [x] **0.3** Create `plan.md` tracking document (this file)

---

### Phase 1: Setup Module Structure

#### 1.1 Create Folder Structure
- [x] **1.1.1-1.1.16** All directories created under `src/modules/`

#### 1.2 Configure Path Aliases
- [x] **1.2.1-1.2.3** Updated `vite.config.ts` with @core, @worktrees, @agent-manager aliases
- [x] **1.2.4-1.2.6** Updated `tsconfig.json` with path mappings
- [x] **1.2.7-1.2.9** Updated `tsconfig.app.json` (extends tsconfig.json)

---

### Phase 2: Core Module

#### 2.1 Move UI Components
- [x] **2.1.1-2.1.14** All UI components moved to `src/modules/core/ui/`
- [x] **2.1.15** Created `src/modules/core/ui/index.ts`

#### 2.2 Move Core Lib
- [x] **2.2.1-2.2.2** Moved utils.ts and commands.ts
- [x] **2.2.3** Created `src/modules/core/lib/index.ts`

#### 2.3 Setup Core Store
- [x] **2.3.1-2.3.3** DEFERRED - Store remains in `src/store/` for now (shared between modules)

#### 2.4 Move Core Components
- [x] **2.4.1-2.4.3** Moved header.tsx, settings-dialog.tsx, theme-toggle.tsx
- [x] **2.4.4** Created `src/modules/core/components/index.ts`

#### 2.5 Core Module Index & Documentation
- [x] **2.5.1** Created `src/modules/core/index.ts`
- [ ] **2.5.2** Create `src/modules/core/README.md` - PENDING
- [ ] **2.5.3** Create `src/modules/core/ui/README.md` - PENDING

#### 2.6 Update Core Imports
- [x] **2.6.1-2.6.3** All imports updated to use relative/module paths

---

### Phase 3: Worktrees Module

#### 3.1 Move Worktree Components
- [x] **3.1.1-3.1.4** All components moved
- [x] **3.1.5** Created `src/modules/worktrees/components/index.ts`

#### 3.2 Move Worktree Lib
- [x] **3.2.1** Moved branch-colors.ts
- [x] **3.2.2** Created `src/modules/worktrees/lib/index.ts`

#### 3.3 Setup Worktree Store
- [x] **3.3.1-3.3.3** DEFERRED - Worktree state remains in shared `src/store/use-app-store.ts`

#### 3.4 Worktree Module Index & Documentation
- [x] **3.4.1** Created `src/modules/worktrees/index.ts`
- [ ] **3.4.2-3.4.3** README files - PENDING

#### 3.5 Update Worktree Imports
- [x] **3.5.1-3.5.3** All imports updated

---

### Phase 4: Agent Manager Module

#### 4.1 Move Agent Manager API
- [x] **4.1.1-4.1.3** Moved opencode.ts, use-agent-sse.ts, created index.ts

#### 4.2 Move Agent Manager Store
- [x] **4.2.1-4.2.4** Moved types.ts, agent-manager-store.ts, created index.ts

#### 4.3 Move Agent Manager Chat Components
- [x] **4.3.1-4.3.4** All chat components moved with index.ts

#### 4.4 Move Agent Manager Tool Components
- [x] **4.4.1-4.4.4** All tool components moved with index.ts

#### 4.5 Move Agent Manager Other Components
- [x] **4.5.1-4.5.11** All components moved including opencode-panel.tsx

#### 4.6 Agent Manager Module Index & Documentation
- [x] **4.6.1** Created `src/modules/agent-manager/index.ts`
- [ ] **4.6.2-4.6.6** README files - PENDING

#### 4.7 Update Agent Manager Imports
- [x] **4.7.1-4.7.5** All imports updated

---

### Phase 5: Update App Entry Points

#### 5.1 Update App.tsx
- [x] **5.1.1-5.1.2** All imports updated to use new module paths

#### 5.2 Update main.tsx
- [x] **5.2.1** No changes needed

---

### Phase 6: Cleanup Old Structure

#### 6.1 Remove Old Directories
- [x] **6.1.1-6.1.5** Deleted src/components/ui/, src/components/agent-manager/, src/components/, src/lib/, src/store/types/

#### 6.2 Remove Old Store File
- [x] **6.2.1-6.2.2** DEFERRED - src/store/ kept with use-app-store.ts and types.ts (shared state)

---

### Phase 7: Verification & Testing

#### 7.1 Type Checking
- [x] **7.1.1** `bun run tsc` - passes
- [x] **7.1.2** No unused imports/exports

#### 7.2 Linting
- [x] **7.2.1** `bun run lint` - passes
- [x] **7.2.2** Import order verified

#### 7.3 Runtime Testing
- [ ] **7.3.1-7.3.10** Manual testing - PENDING (requires `bun run tauri dev`)

#### 7.4 Rust Backend
- [x] **7.4.1** `cargo test` - 54 tests passed
- [x] **7.4.2** `cargo check` - passes

---

### Phase 8: Documentation Updates

- [x] **8.1.1-8.1.4** Update ARCHITECTURE.md - COMPLETED
- [x] **8.2.1-8.2.3** Update AGENTS.md - COMPLETED
- [x] **8.3.1-8.3.6** Rust documentation - N/A (covered in plan-2.md)

---

### Phase 9: Final Review

- [x] **9.1** Index.ts exports verified
- [x] **9.2** Path aliases work correctly
- [x] **9.3** `bun run build` - successful
- [ ] **9.4** `bun run tauri build` - PENDING (optional)
- [ ] **9.5** Delete/archive this plan.md - PENDING

---

## Notes

- **Store splitting deferred**: The original plan called for splitting the store into module-specific stores. This was deferred as the current shared store (`src/store/use-app-store.ts`) works well and avoids complexity. Types are re-exported from `src/store/types.ts` for backwards compatibility.
- **README files pending**: Module README documentation is pending but not blocking.
- **opencode-panel.tsx**: Was marked for potential deletion but is actively used; moved to agent-manager module.

## Deviations from Original Plan

1. **Store architecture**: Kept shared store in `src/store/` rather than splitting into module stores
2. **Types location**: `src/store/types.ts` re-exports agent-manager types for backwards compatibility
3. **opencode-panel.tsx**: Moved to agent-manager instead of deleted

---

## Related Work

After completing this frontend reorganization, proceed to **[plan-2.md](./plan-2.md)** for the Rust backend reorganization. Both plans can be executed in parallel by different engineers, but should be coordinated to ensure the app remains functional throughout the process.
