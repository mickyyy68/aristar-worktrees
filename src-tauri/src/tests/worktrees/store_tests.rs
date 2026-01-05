//! Store tests for worktrees.

use crate::tests::helpers::TestRepo;
use crate::worktrees::operations;
use crate::worktrees::store::init_store;
use crate::worktrees::types::{Repository, WorktreeInfo};

// ============================================================================
// Helper to create test state
// ============================================================================

fn create_test_state() -> crate::worktrees::store::AppState {
    init_store()
}

fn create_test_repository(id: &str, path: &str, name: &str) -> Repository {
    Repository {
        id: id.to_string(),
        path: path.to_string(),
        name: name.to_string(),
        worktrees: vec![],
        last_scanned: 0,
    }
}

fn create_test_worktree(id: &str, name: &str, path: &str) -> WorktreeInfo {
    WorktreeInfo {
        id: id.to_string(),
        name: name.to_string(),
        path: path.to_string(),
        branch: Some("main".to_string()),
        commit: None,
        is_main: false,
        is_locked: false,
        lock_reason: None,
        startup_script: None,
        script_executed: false,
        created_at: 0,
    }
}

// ============================================================================
// init_store tests
// ============================================================================

// NOTE: These tests may fail if there's already data in the store file.
// In a real test environment, we would use a test-specific store path.

#[test]
fn test_init_store_default_settings() {
    let state = init_store();
    let store = state.store.read().unwrap();

    // Default settings should be set
    assert_eq!(store.settings.theme_name, "aristar");
    assert_eq!(store.settings.color_scheme, "system");
    assert!(store.settings.auto_refresh);
}

// ============================================================================
// StoreData tests
// ============================================================================

#[test]
fn test_store_data_add_repository() {
    let state = create_test_state();
    let initial_count = {
        let store = state.store.read().unwrap();
        store.repositories.len()
    };

    {
        let mut store = state.store.write().unwrap();
        let repo = create_test_repository("repo-1", "/path/to/repo", "my-repo");
        store.repositories.push(repo);
    }

    let store = state.store.read().unwrap();
    assert_eq!(store.repositories.len(), initial_count + 1);
}

#[test]
fn test_store_data_find_repository_by_id() {
    let state = create_test_state();

    {
        let mut store = state.store.write().unwrap();
        store
            .repositories
            .push(create_test_repository("find-me", "/path/find", "find-repo"));
        store
            .repositories
            .push(create_test_repository("other", "/path/other", "other-repo"));
    }

    let store = state.store.read().unwrap();
    let found = store.repositories.iter().find(|r| r.id == "find-me");
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "find-repo");
}

#[test]
fn test_store_data_update_repository() {
    let state = create_test_state();

    {
        let mut store = state.store.write().unwrap();
        store.repositories.push(create_test_repository(
            "update-me",
            "/path/update",
            "update-repo",
        ));
    }

    {
        let mut store = state.store.write().unwrap();
        if let Some(repo) = store.repositories.iter_mut().find(|r| r.id == "update-me") {
            repo.name = "updated-name".to_string();
        }
    }

    let store = state.store.read().unwrap();
    let repo = store.repositories.iter().find(|r| r.id == "update-me");
    assert!(repo.is_some());
    assert_eq!(repo.unwrap().name, "updated-name");
}

// ============================================================================
// Repository with worktrees tests
// ============================================================================

#[test]
fn test_repository_add_worktree() {
    let state = create_test_state();
    let mut repo = create_test_repository("repo-wt", "/path/worktrees", "wt-repo");

    let worktree = create_test_worktree("wt-1", "feature", "/path/worktrees/feature");
    repo.worktrees.push(worktree);

    {
        let mut store = state.store.write().unwrap();
        store.repositories.push(repo);
    }

    let store = state.store.read().unwrap();
    let repo = store
        .repositories
        .iter()
        .find(|r| r.id == "repo-wt")
        .unwrap();
    assert_eq!(repo.worktrees.len(), 1);
    assert_eq!(repo.worktrees[0].name, "feature");
}

#[test]
fn test_repository_find_worktree_by_path() {
    let state = create_test_state();
    let mut repo = create_test_repository("repo-find-wt", "/path/repo", "find-wt-repo");
    repo.worktrees.push(create_test_worktree(
        "wt-1",
        "feature-1",
        "/path/repo/feature-1",
    ));
    repo.worktrees.push(create_test_worktree(
        "wt-2",
        "feature-2",
        "/path/repo/feature-2",
    ));

    {
        let mut store = state.store.write().unwrap();
        store.repositories.push(repo);
    }

    let store = state.store.read().unwrap();
    let repo = store
        .repositories
        .iter()
        .find(|r| r.id == "repo-find-wt")
        .unwrap();
    let worktree = repo
        .worktrees
        .iter()
        .find(|w| w.path == "/path/repo/feature-2");
    assert!(worktree.is_some());
    assert_eq!(worktree.unwrap().name, "feature-2");
}

// ============================================================================
// RwLock and concurrency tests
// ============================================================================

#[test]
fn test_state_rwlock_read() {
    let state = create_test_state();

    // Test that we can acquire and release read lock
    {
        let _store = state.store.read().unwrap();
        // Lock acquired
    }
    // Lock released

    // Should be able to acquire again
    {
        let _store = state.store.read().unwrap();
    }
}

#[test]
fn test_state_rwlock_write() {
    let state = create_test_state();

    // Test that we can acquire and release write lock
    {
        let _store = state.store.write().unwrap();
        // Lock acquired
    }
    // Lock released

    // Should be able to acquire again
    {
        let _store = state.store.write().unwrap();
    }
}

// ============================================================================
// Integration with real repository
// ============================================================================

#[test]
fn test_list_worktrees_with_real_repo() {
    let repo = TestRepo::new();
    let worktrees = operations::list_worktrees(&repo.path_str());
    assert!(worktrees.is_ok());
    let worktrees = worktrees.unwrap();

    // Should have at least the main worktree
    assert!(!worktrees.is_empty());

    // Main worktree should be marked
    let main_wt = worktrees.iter().find(|w| w.is_main);
    assert!(main_wt.is_some());
}
