# Rust Backend Module Reorganization Plan

> **TL;DR**: Reorganize the Rust backend (`src-tauri/src/`) into a modular structure with three main modules: `core` (shared infrastructure), `worktrees` (git worktree management), and `agent_manager` (AI agent orchestration). Each module has its own README.md, types, operations, and Tauri commands.

## Prerequisites

- Complete frontend reorganization (plan.md) first, or run in parallel
- Ensure all existing tests pass before starting: `cargo test`

## Target Structure

```
src-tauri/src/
├── main.rs                      # Entry point - command registration only
├── lib.rs                       # Library exports
│
├── core/                        # Shared infrastructure
│   ├── mod.rs
│   ├── README.md
│   ├── persistence.rs           # Store load/save utilities
│   ├── types.rs                 # Shared types (AppSettings)
│   └── system.rs                # System operations (clipboard, finder)
│
├── worktrees/                   # Worktree management module
│   ├── mod.rs
│   ├── README.md
│   ├── types.rs                 # WorktreeInfo, Repository, BranchInfo, CommitInfo, StoreData
│   ├── operations.rs            # Git worktree operations
│   ├── external_apps.rs         # Terminal/editor integration
│   ├── store.rs                 # Worktree state (AppState)
│   └── commands.rs              # Tauri commands
│
├── agent_manager/               # Agent manager module
│   ├── mod.rs
│   ├── README.md
│   ├── types.rs                 # Task, TaskAgent, AgentStatus, ModelSelection, TaskStoreData
│   ├── task_operations.rs       # Task CRUD operations
│   ├── agent_operations.rs      # Agent management operations
│   ├── opencode.rs              # OpenCode process manager
│   ├── store.rs                 # Task state (TaskManagerState)
│   └── commands.rs              # Tauri commands
│
└── tests/                       # Centralized tests
    ├── mod.rs
    ├── helpers.rs               # Shared test utilities
    ├── worktrees/
    │   ├── mod.rs
    │   ├── operations_tests.rs
    │   ├── store_tests.rs
    │   └── integration_tests.rs
    └── agent_manager/
        ├── mod.rs
        └── task_tests.rs
```

---

## Backlog

### Phase 0: Preparation & Verification

- [ ] **0.1** Run `cargo test` - ensure all existing tests pass
- [ ] **0.2** Run `cargo clippy` - ensure no warnings
- [ ] **0.3** Create a git commit/branch for safety before refactoring
- [ ] **0.4** Review current `commands/mod.rs` to understand all exports

---

### Phase 1: Setup Module Structure

#### 1.1 Create Core Module Directories
- [ ] **1.1.1** Create directory `src-tauri/src/core/`
- [ ] **1.1.2** Create file `src-tauri/src/core/mod.rs` with empty module declarations
- [ ] **1.1.3** Create file `src-tauri/src/core/types.rs` with placeholder
- [ ] **1.1.4** Create file `src-tauri/src/core/persistence.rs` with placeholder
- [ ] **1.1.5** Create file `src-tauri/src/core/system.rs` with placeholder

#### 1.2 Create Worktrees Module Directories
- [ ] **1.2.1** Create directory `src-tauri/src/worktrees/`
- [ ] **1.2.2** Create file `src-tauri/src/worktrees/mod.rs` with empty module declarations
- [ ] **1.2.3** Create file `src-tauri/src/worktrees/types.rs` with placeholder
- [ ] **1.2.4** Create file `src-tauri/src/worktrees/operations.rs` with placeholder
- [ ] **1.2.5** Create file `src-tauri/src/worktrees/external_apps.rs` with placeholder
- [ ] **1.2.6** Create file `src-tauri/src/worktrees/store.rs` with placeholder
- [ ] **1.2.7** Create file `src-tauri/src/worktrees/commands.rs` with placeholder

#### 1.3 Create Agent Manager Module Directories
- [ ] **1.3.1** Create directory `src-tauri/src/agent_manager/`
- [ ] **1.3.2** Create file `src-tauri/src/agent_manager/mod.rs` with empty module declarations
- [ ] **1.3.3** Create file `src-tauri/src/agent_manager/types.rs` with placeholder
- [ ] **1.3.4** Create file `src-tauri/src/agent_manager/task_operations.rs` with placeholder
- [ ] **1.3.5** Create file `src-tauri/src/agent_manager/agent_operations.rs` with placeholder
- [ ] **1.3.6** Create file `src-tauri/src/agent_manager/opencode.rs` with placeholder
- [ ] **1.3.7** Create file `src-tauri/src/agent_manager/store.rs` with placeholder
- [ ] **1.3.8** Create file `src-tauri/src/agent_manager/commands.rs` with placeholder

#### 1.4 Create Test Directories
- [ ] **1.4.1** Create directory `src-tauri/src/tests/`
- [ ] **1.4.2** Create directory `src-tauri/src/tests/worktrees/`
- [ ] **1.4.3** Create directory `src-tauri/src/tests/agent_manager/`
- [ ] **1.4.4** Create file `src-tauri/src/tests/mod.rs` with module declarations
- [ ] **1.4.5** Create file `src-tauri/src/tests/helpers.rs` with placeholder
- [ ] **1.4.6** Create file `src-tauri/src/tests/worktrees/mod.rs` with placeholder
- [ ] **1.4.7** Create file `src-tauri/src/tests/agent_manager/mod.rs` with placeholder

---

### Phase 2: Core Module Implementation

#### 2.1 Extract Core Types
- [ ] **2.1.1** Move `AppSettings` struct from `models/mod.rs` → `core/types.rs`
- [ ] **2.1.2** Add necessary imports to `core/types.rs` (serde)
- [ ] **2.1.3** Export `AppSettings` from `core/mod.rs`
- [ ] **2.1.4** Run `cargo check` - fix any compilation errors

#### 2.2 Extract Persistence Utilities
- [ ] **2.2.1** Move `get_store_path()` from `commands/mod.rs` → `core/persistence.rs`
- [ ] **2.2.2** Move `load_store_data()` from `commands/mod.rs` → `core/persistence.rs`
- [ ] **2.2.3** Move `save_store_data()` from `commands/mod.rs` → `core/persistence.rs`
- [ ] **2.2.4** Move `get_aristar_worktrees_base()` from `commands/worktree.rs` → `core/persistence.rs`
- [ ] **2.2.5** Add necessary imports to `core/persistence.rs`
- [ ] **2.2.6** Export persistence functions from `core/mod.rs`
- [ ] **2.2.7** Run `cargo check` - fix any compilation errors

#### 2.3 Extract System Utilities
- [ ] **2.3.1** Move `reveal_in_finder()` from `commands/worktree.rs` → `core/system.rs`
- [ ] **2.3.2** Move `copy_to_clipboard()` from `commands/worktree.rs` → `core/system.rs`
- [ ] **2.3.3** Add necessary imports to `core/system.rs`
- [ ] **2.3.4** Export system functions from `core/mod.rs`
- [ ] **2.3.5** Run `cargo check` - fix any compilation errors

#### 2.4 Core Module Index & Documentation
- [ ] **2.4.1** Update `core/mod.rs` with all public exports
- [ ] **2.4.2** Create `core/README.md` with:
  - TL;DR
  - Overview
  - File structure
  - Function signatures with descriptions
  - Usage examples
- [ ] **2.4.3** Run `cargo doc` - verify documentation builds

---

### Phase 3: Worktrees Module Implementation

#### 3.1 Extract Worktree Types
- [ ] **3.1.1** Move `WorktreeInfo` struct from `commands/worktree.rs` → `worktrees/types.rs`
- [ ] **3.1.2** Move `Repository` struct from `commands/worktree.rs` → `worktrees/types.rs`
- [ ] **3.1.3** Move `BranchInfo` struct from `commands/worktree.rs` → `worktrees/types.rs`
- [ ] **3.1.4** Move `CommitInfo` struct from `commands/worktree.rs` → `worktrees/types.rs`
- [ ] **3.1.5** Move `StoreData` struct from `commands/worktree.rs` → `worktrees/types.rs`
- [ ] **3.1.6** Add necessary imports to `worktrees/types.rs` (serde, chrono)
- [ ] **3.1.7** Export types from `worktrees/mod.rs`
- [ ] **3.1.8** Run `cargo check` - fix any compilation errors

#### 3.2 Extract Worktree Operations
- [ ] **3.2.1** Move `is_git_repository()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.2** Move `get_repository_name()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.3** Move `get_repo_hash()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.4** Move `get_worktree_base_for_repo()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.5** Move `ensure_repo_info()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.6** Move `list_worktrees()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.7** Move `create_worktree()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.8** Move `remove_worktree()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.9** Move `rename_worktree()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.10** Move `lock_worktree()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.11** Move `unlock_worktree()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.12** Move `get_branches()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.13** Move `get_commits()` from `commands/worktree.rs` → `worktrees/operations.rs`
- [ ] **3.2.14** Add necessary imports to `worktrees/operations.rs`
- [ ] **3.2.15** Export operations from `worktrees/mod.rs`
- [ ] **3.2.16** Run `cargo check` - fix any compilation errors

#### 3.3 Extract External Apps Integration
- [ ] **3.3.1** Move `open_in_terminal()` from `commands/worktree.rs` → `worktrees/external_apps.rs`
- [ ] **3.3.2** Move `open_in_editor()` from `commands/worktree.rs` → `worktrees/external_apps.rs`
- [ ] **3.3.3** Move helper functions for terminal/editor commands → `worktrees/external_apps.rs`
- [ ] **3.3.4** Add necessary imports to `worktrees/external_apps.rs`
- [ ] **3.3.5** Export external app functions from `worktrees/mod.rs`
- [ ] **3.3.6** Run `cargo check` - fix any compilation errors

#### 3.4 Extract Worktree Store
- [ ] **3.4.1** Move `AppState` struct from `commands/mod.rs` → `worktrees/store.rs`
- [ ] **3.4.2** Move `AppState::save()` method → `worktrees/store.rs`
- [ ] **3.4.3** Add `init_store()` function to `worktrees/store.rs`
- [ ] **3.4.4** Add necessary imports to `worktrees/store.rs`
- [ ] **3.4.5** Export `AppState` and `init_store` from `worktrees/mod.rs`
- [ ] **3.4.6** Run `cargo check` - fix any compilation errors

#### 3.5 Create Worktree Commands
- [ ] **3.5.1** Create `worktrees/commands.rs` with all worktree Tauri commands:
  - `get_repositories`
  - `add_repository`
  - `remove_repository`
  - `refresh_repository`
  - `list_worktrees`
  - `create_worktree`
  - `remove_worktree`
  - `rename_worktree`
  - `lock_worktree`
  - `unlock_worktree`
  - `get_branches`
  - `get_commits`
  - `open_in_terminal`
  - `open_in_editor`
  - `reveal_in_finder`
  - `copy_to_clipboard`
- [ ] **3.5.2** Add `#[tauri::command]` attributes to all commands
- [ ] **3.5.3** Update commands to use new module paths (`worktrees::operations::`, etc.)
- [ ] **3.5.4** Export commands from `worktrees/mod.rs`
- [ ] **3.5.5** Run `cargo check` - fix any compilation errors

#### 3.6 Worktree Module Index & Documentation
- [ ] **3.6.1** Update `worktrees/mod.rs` with all public exports
- [ ] **3.6.2** Create `worktrees/README.md` with:
  - TL;DR
  - Overview
  - File structure
  - Types documentation (all structs with fields)
  - Operations documentation (function signatures, parameters, return types)
  - Commands documentation (all Tauri commands)
  - Error handling patterns
  - Usage examples
- [ ] **3.6.3** Run `cargo doc` - verify documentation builds

---

### Phase 4: Agent Manager Module Implementation

#### 4.1 Extract Agent Manager Types
- [ ] **4.1.1** Move `TaskStatus` enum from `models/task.rs` → `agent_manager/types.rs`
- [ ] **4.1.2** Move `AgentStatus` enum from `models/task.rs` → `agent_manager/types.rs`
- [ ] **4.1.3** Move `TaskAgent` struct from `models/task.rs` → `agent_manager/types.rs`
- [ ] **4.1.4** Move `Task` struct from `models/task.rs` → `agent_manager/types.rs`
- [ ] **4.1.5** Move `ModelSelection` struct from `models/task.rs` → `agent_manager/types.rs`
- [ ] **4.1.6** Move `TaskStoreData` struct from `models/task.rs` → `agent_manager/types.rs`
- [ ] **4.1.7** Add necessary imports to `agent_manager/types.rs`
- [ ] **4.1.8** Export types from `agent_manager/mod.rs`
- [ ] **4.1.9** Run `cargo check` - fix any compilation errors

#### 4.2 Extract Task Operations
- [ ] **4.2.1** Move `get_tasks_base_path()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.2** Move `get_tasks_store_path()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.3** Move `get_task_folder_path()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.4** Move `generate_task_id()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.5** Move `slugify()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.6** Move `slugify_model_id()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.7** Move `load_tasks()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.8** Move `save_tasks()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.9** Move `create_task_impl()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.10** Move `get_tasks_impl()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.11** Move `get_task_impl()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.12** Move `update_task_impl()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.13** Move `delete_task_impl()` from `commands/task_manager.rs` → `agent_manager/task_operations.rs`
- [ ] **4.2.14** Add necessary imports to `agent_manager/task_operations.rs`
- [ ] **4.2.15** Export task operations from `agent_manager/mod.rs`
- [ ] **4.2.16** Run `cargo check` - fix any compilation errors

#### 4.3 Extract Agent Operations
- [ ] **4.3.1** Move `generate_agent_id()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.2** Move `add_agent_to_task_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.3** Move `remove_agent_from_task_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.4** Move `update_agent_session_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.5** Move `update_agent_status_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.6** Move `accept_agent_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.7** Move `cleanup_unaccepted_agents_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.8** Move `validate_task_worktrees_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.9** Move `recreate_agent_worktree_impl()` from `commands/task_manager.rs` → `agent_manager/agent_operations.rs`
- [ ] **4.3.10** Add necessary imports to `agent_manager/agent_operations.rs`
- [ ] **4.3.11** Export agent operations from `agent_manager/mod.rs`
- [ ] **4.3.12** Run `cargo check` - fix any compilation errors

#### 4.4 Extract OpenCode Manager
- [ ] **4.4.1** Move `OpenCodeInstance` struct from `commands/opencode_manager.rs` → `agent_manager/opencode.rs`
- [ ] **4.4.2** Move `OpenCodeManager` struct from `commands/opencode_manager.rs` → `agent_manager/opencode.rs`
- [ ] **4.4.3** Move all `OpenCodeManager` impl methods → `agent_manager/opencode.rs`
- [ ] **4.4.4** Add necessary imports to `agent_manager/opencode.rs`
- [ ] **4.4.5** Export `OpenCodeManager` from `agent_manager/mod.rs`
- [ ] **4.4.6** Run `cargo check` - fix any compilation errors

#### 4.5 Extract Agent Manager Store
- [ ] **4.5.1** Move `TaskManagerState` struct from `commands/task_manager.rs` → `agent_manager/store.rs`
- [ ] **4.5.2** Move `TaskManagerState::new()` from `commands/task_manager.rs` → `agent_manager/store.rs`
- [ ] **4.5.3** Add necessary imports to `agent_manager/store.rs`
- [ ] **4.5.4** Export `TaskManagerState` from `agent_manager/mod.rs`
- [ ] **4.5.5** Run `cargo check` - fix any compilation errors

#### 4.6 Create Agent Manager Commands
- [ ] **4.6.1** Create `agent_manager/commands.rs` with all agent manager Tauri commands:
  - `create_task`
  - `get_tasks`
  - `get_task`
  - `update_task`
  - `delete_task`
  - `add_agent_to_task`
  - `remove_agent_from_task`
  - `update_agent_session`
  - `update_agent_status`
  - `accept_agent`
  - `cleanup_unaccepted_agents`
  - `start_agent_opencode`
  - `stop_agent_opencode`
  - `get_agent_opencode_port`
  - `stop_task_all_opencode`
  - `validate_task_worktrees`
  - `recreate_agent_worktree`
- [ ] **4.6.2** Add `#[tauri::command]` attributes to all commands
- [ ] **4.6.3** Update commands to use new module paths
- [ ] **4.6.4** Export commands from `agent_manager/mod.rs`
- [ ] **4.6.5** Run `cargo check` - fix any compilation errors

#### 4.7 Agent Manager Module Index & Documentation
- [ ] **4.7.1** Update `agent_manager/mod.rs` with all public exports
- [ ] **4.7.2** Create `agent_manager/README.md` with:
  - TL;DR
  - Overview
  - File structure
  - Types documentation (all structs/enums with fields)
  - Task operations documentation
  - Agent operations documentation
  - OpenCode manager documentation
  - Commands documentation (all Tauri commands)
  - Error handling patterns
  - Usage examples
- [ ] **4.7.3** Run `cargo doc` - verify documentation builds

---

### Phase 5: Update Entry Points

#### 5.1 Update main.rs
- [ ] **5.1.1** Remove `mod commands;` declaration
- [ ] **5.1.2** Remove `mod models;` declaration
- [ ] **5.1.3** Add `mod core;` declaration
- [ ] **5.1.4** Add `mod worktrees;` declaration
- [ ] **5.1.5** Add `mod agent_manager;` declaration
- [ ] **5.1.6** Add `#[cfg(test)] mod tests;` declaration
- [ ] **5.1.7** Update `init_store()` call to use `worktrees::store::init_store()`
- [ ] **5.1.8** Update `OpenCodeManager::new()` call to use `agent_manager::opencode::OpenCodeManager::new()`
- [ ] **5.1.9** Update `TaskManagerState::new()` call to use `agent_manager::store::TaskManagerState::new()`
- [ ] **5.1.10** Update `invoke_handler` to use new command paths:
  - `worktrees::commands::*` for worktree commands
  - `agent_manager::commands::*` for agent manager commands
- [ ] **5.1.11** Update `on_window_event` cleanup to use new `OpenCodeManager` path
- [ ] **5.1.12** Run `cargo check` - fix any compilation errors

#### 5.2 Update lib.rs
- [ ] **5.2.1** Remove old module declarations
- [ ] **5.2.2** Add new module declarations (`core`, `worktrees`, `agent_manager`)
- [ ] **5.2.3** Update public exports to use new module paths
- [ ] **5.2.4** Run `cargo check` - fix any compilation errors

---

### Phase 6: Migrate Tests

#### 6.1 Move Test Helpers
- [ ] **6.1.1** Move `commands/tests/helpers.rs` → `tests/helpers.rs`
- [ ] **6.1.2** Update helper imports to use new module paths
- [ ] **6.1.3** Export helpers from `tests/mod.rs`

#### 6.2 Move Worktree Tests
- [ ] **6.2.1** Move `commands/tests/worktree_unit_tests.rs` → `tests/worktrees/operations_tests.rs`
- [ ] **6.2.2** Move `commands/tests/state_tests.rs` → `tests/worktrees/store_tests.rs`
- [ ] **6.2.3** Move `commands/tests/worktree_integration_tests.rs` → `tests/worktrees/integration_tests.rs`
- [ ] **6.2.4** Update test imports to use new module paths (`crate::worktrees::*`)
- [ ] **6.2.5** Create `tests/worktrees/mod.rs` with test module declarations
- [ ] **6.2.6** Run `cargo test` - fix any failing tests

#### 6.3 Create Agent Manager Tests
- [ ] **6.3.1** Create `tests/agent_manager/task_tests.rs` with basic task operation tests
- [ ] **6.3.2** Create `tests/agent_manager/mod.rs` with test module declarations
- [ ] **6.3.3** Run `cargo test` - verify new tests pass

#### 6.4 Update Test Module Index
- [ ] **6.4.1** Update `tests/mod.rs` to include all test submodules
- [ ] **6.4.2** Run `cargo test` - ensure all tests pass

---

### Phase 7: Cleanup Old Structure

#### 7.1 Remove Old Command Files
- [ ] **7.1.1** Delete `src-tauri/src/commands/mod.rs`
- [ ] **7.1.2** Delete `src-tauri/src/commands/worktree.rs`
- [ ] **7.1.3** Delete `src-tauri/src/commands/opencode_manager.rs`
- [ ] **7.1.4** Delete `src-tauri/src/commands/task_manager.rs`
- [ ] **7.1.5** Delete `src-tauri/src/commands/tests/` directory
- [ ] **7.1.6** Delete `src-tauri/src/commands/` directory

#### 7.2 Remove Old Model Files
- [ ] **7.2.1** Delete `src-tauri/src/models/mod.rs`
- [ ] **7.2.2** Delete `src-tauri/src/models/task.rs`
- [ ] **7.2.3** Delete `src-tauri/src/models/` directory

#### 7.3 Verify Cleanup
- [ ] **7.3.1** Run `cargo check` - ensure no compilation errors
- [ ] **7.3.2** Run `cargo test` - ensure all tests pass
- [ ] **7.3.3** Run `cargo clippy` - ensure no warnings

---

### Phase 8: Verification & Final Testing

#### 8.1 Compilation & Linting
- [ ] **8.1.1** Run `cargo build` - ensure successful build
- [ ] **8.1.2** Run `cargo build --release` - ensure release build works
- [ ] **8.1.3** Run `cargo clippy` - fix any warnings
- [ ] **8.1.4** Run `cargo fmt` - ensure consistent formatting

#### 8.2 Test Suite
- [ ] **8.2.1** Run `cargo test` - all tests must pass
- [ ] **8.2.2** Run `cargo test -- --nocapture` - review test output
- [ ] **8.2.3** Verify test count matches original (no tests lost)

#### 8.3 Integration Testing
- [ ] **8.3.1** Run `bun run tauri dev` - verify app starts
- [ ] **8.3.2** Test adding a repository
- [ ] **8.3.3** Test creating a worktree
- [ ] **8.3.4** Test removing a worktree
- [ ] **8.3.5** Test opening worktree in terminal
- [ ] **8.3.6** Test opening worktree in editor
- [ ] **8.3.7** Test Agent Manager - create task
- [ ] **8.3.8** Test Agent Manager - start agent
- [ ] **8.3.9** Test Agent Manager - chat interaction
- [ ] **8.3.10** Test settings persistence

#### 8.4 Documentation Verification
- [ ] **8.4.1** Run `cargo doc --open` - verify all documentation builds
- [ ] **8.4.2** Review generated docs for completeness
- [ ] **8.4.3** Verify all README.md files are accurate

---

### Phase 9: Final Documentation

#### 9.1 Module README Files
- [ ] **9.1.1** Review and finalize `core/README.md`
- [ ] **9.1.2** Review and finalize `worktrees/README.md`
- [ ] **9.1.3** Review and finalize `agent_manager/README.md`

#### 9.2 Update Project Documentation
- [ ] **9.2.1** Update `docs/ARCHITECTURE.md` - add Rust Module System section
- [ ] **9.2.2** Update `docs/ARCHITECTURE.md` - update Backend Architecture section
- [ ] **9.2.3** Update `AGENTS.md` - update Rust Commands section
- [ ] **9.2.4** Update `AGENTS.md` - add module-specific test commands

#### 9.3 Create Backend Overview
- [ ] **9.3.1** Create `src-tauri/README.md` with:
  - Overview of backend architecture
  - Module descriptions
  - How to add new commands
  - Testing guide
  - Links to module READMEs

---

### Phase 10: Final Review

- [ ] **10.1** Review all new files for consistent code style
- [ ] **10.2** Verify all public APIs are documented
- [ ] **10.3** Run full test suite one more time
- [ ] **10.4** Run app and perform smoke test
- [ ] **10.5** Create git commit with all changes
- [ ] **10.6** Update `plan.md` reference to mark backend reorganization complete

---

## Notes

- Each task is designed to be small and isolated
- Run `cargo check` frequently to catch errors early
- Keep the app runnable at each phase boundary
- If a task fails, fix it before proceeding to dependent tasks
- The `#[allow(dead_code)]` attribute may be needed temporarily during migration

## Estimated Effort

- **Phase 0**: ~15 minutes (preparation)
- **Phase 1**: ~30 minutes (directory setup)
- **Phase 2**: ~1 hour (core module)
- **Phase 3**: ~2-3 hours (worktrees module - largest)
- **Phase 4**: ~2 hours (agent manager module)
- **Phase 5**: ~30 minutes (entry points)
- **Phase 6**: ~1 hour (tests)
- **Phase 7**: ~15 minutes (cleanup)
- **Phase 8**: ~1 hour (verification)
- **Phase 9**: ~1-2 hours (documentation)
- **Phase 10**: ~30 minutes (final review)

**Total**: ~10-13 hours

## Dependencies

This plan depends on:
- Rust toolchain installed
- All current tests passing before starting
- Frontend reorganization (plan.md) can run in parallel but should be coordinated
