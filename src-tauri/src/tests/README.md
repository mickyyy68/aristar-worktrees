# Tests Module

> **TL;DR**: Centralized test suite with shared utilities for testing git worktree and agent manager functionality.

## Overview

The `tests` module contains all unit and integration tests for the Rust backend. Tests are organized by feature module and share common test utilities.

## File Structure

```
tests/
├── mod.rs              # Module exports
├── helpers.rs          # Shared test utilities (TestRepo, etc.)
├── worktrees/          # Worktree tests
│   ├── mod.rs
│   ├── operations_tests.rs   # Unit tests for git operations
│   ├── store_tests.rs        # State management tests
│   └── integration_tests.rs  # End-to-end worktree tests
├── agent_manager/      # Agent manager tests
│   ├── mod.rs
│   └── task_tests.rs   # Task operation tests
└── README.md           # This file
```

## Running Tests

```bash
cd src-tauri

# Run all tests
cargo test

# Run tests in a specific module
cargo test tests::worktrees::operations_tests
cargo test tests::worktrees::store_tests
cargo test tests::worktrees::integration_tests
cargo test tests::agent_manager::task_tests

# Run a single test by name
cargo test test_get_repository_name_simple_path

# Run tests with output (for debugging)
cargo test -- --nocapture

# Run tests with backtrace
RUST_BACKTRACE=1 cargo test
```

## Test Utilities (`helpers.rs`)

### `TestRepo`

A test fixture that creates a temporary git repository.

```rust
pub struct TestRepo {
    pub temp_dir: TempDir,  // Auto-cleaned on drop
}

impl TestRepo {
    /// Create a new repo with initial commit
    pub fn new() -> Self

    /// Create a repo with pre-made branches
    pub fn with_branches(branch_names: &[&str]) -> Self

    /// Get the repository path
    pub fn path(&self) -> &Path
    pub fn path_str(&self) -> String

    /// Create a new commit
    pub fn commit(&self, message: &str)

    /// Create a new branch
    pub fn create_branch(&self, name: &str)

    /// Checkout a branch
    pub fn checkout(&self, branch: &str)

    /// Get current branch name
    pub fn current_branch(&self) -> String
}
```

### `create_non_git_dir`

Creates a temporary directory that is NOT a git repository (for error case testing).

```rust
pub fn create_non_git_dir() -> TempDir
```

## Test Categories

### Operations Tests (`worktrees/operations_tests.rs`)

Unit tests for low-level git operations:

| Test | Description |
|------|-------------|
| `test_is_git_repository_*` | Git repo detection |
| `test_get_repository_name_*` | Path parsing |
| `test_run_git_command_*` | Git command execution |
| `test_get_current_branch_*` | Branch detection |
| `test_get_branches_*` | Branch listing |

### Store Tests (`worktrees/store_tests.rs`)

State management tests:

| Test | Description |
|------|-------------|
| `test_init_store_*` | Store initialization |
| `test_store_data_*` | Repository CRUD |
| `test_repository_*` | Worktree management within repos |
| `test_state_rwlock_*` | RwLock concurrency safety |

### Security Tests (`worktrees/security_tests.rs`)

Security validation tests:

| Test | Description |
|------|-------------|
| `test_validate_custom_command_*` | Command injection prevention |
| `test_validate_path_within_bases_*` | Path traversal prevention |
| `test_get_allowed_worktree_bases_*` | Allowed base directory validation |

### Integration Tests (`worktrees/integration_tests.rs`)

End-to-end worktree operations:

| Test | Description |
|------|-------------|
| `test_list_worktrees_*` | Worktree listing |
| `test_create_worktree_*` | Worktree creation |
| `test_remove_worktree_*` | Worktree removal |
| `test_rename_worktree_*` | Worktree renaming |
| `test_lock_worktree_*` | Worktree locking |
| `test_unlock_worktree` | Worktree unlocking |
| `test_lock_prevents_removal` | Lock protection |

### Task Tests (`agent_manager/task_tests.rs`)

Task manager utilities:

| Test | Description |
|------|-------------|
| `test_generate_task_id_*` | ID generation |
| `test_slugify_*` | Name slugification |
| `test_slugify_model_id_*` | Model ID slugification |

### OpenCode Tests (`agent_manager/opencode_tests.rs`)

OpenCode process management tests:

| Test | Description |
|------|-------------|
| `test_get_pid_file_path_*` | PID file path validation |
| `test_save_pid_*` | PID file write operations |
| `test_remove_pid_*` | PID file entry removal |

## Writing New Tests

### Basic Test Structure

```rust
#[test]
fn test_feature_scenario() {
    // Arrange
    let repo = TestRepo::new();
    repo.create_branch("feature-branch");

    // Act
    let result = some_operation(&repo.path_str());

    // Assert
    assert!(result.is_ok());
    assert_eq!(result.unwrap().name, "expected");
}
```

### Testing Error Cases

```rust
#[test]
fn test_operation_fails_on_invalid_input() {
    let result = operation_that_should_fail("/nonexistent/path");
    assert!(result.is_err());
}
```

### Testing with Multiple Branches

```rust
#[test]
fn test_with_multiple_branches() {
    let repo = TestRepo::with_branches(&["feature-1", "feature-2", "bugfix"]);
    let branches = get_branches(&repo.path_str()).unwrap();
    assert!(branches.len() >= 4);  // main + 3 branches
}
```

## Test Isolation

- Each test gets its own `TempDir` via `TestRepo`
- Directories are automatically cleaned up when `TestRepo` is dropped
- Tests run in parallel by default (use `#[serial]` if needed)

## Known Limitations

- **Store tests**: May be affected by existing `~/.aristar-worktrees/store.json`
- **Platform**: Tests assume macOS git behavior
- **Startup script tests**: May fail on some systems due to shell execution

## Test Count

Current test count: **92 tests**

```
tests::agent_manager::task_tests: 9 tests
tests::agent_manager::opencode_tests: 12 tests
tests::worktrees::operations_tests: 20 tests
tests::worktrees::store_tests: 10 tests
tests::worktrees::security_tests: 25 tests
tests::worktrees::integration_tests: 16 tests
```
