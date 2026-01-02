use crate::commands::worktree::{Repository, StoreData, WorktreeInfo};
use crate::commands::{init_store, AppState};

use super::helpers::TestRepo;

// ============================================================================
// Helper to create test state
// ============================================================================

fn create_test_state() -> AppState {
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

#[test]
fn test_init_store_creates_empty_state() {
    let state = init_store();
    let store = state.store.lock().unwrap();

    assert!(store.repositories.is_empty());
}

#[test]
fn test_init_store_default_settings() {
    let state = init_store();
    let store = state.store.lock().unwrap();

    // Default settings should be set
    assert_eq!(store.settings.theme, "");
    assert!(!store.settings.auto_refresh);
}

// ============================================================================
// StoreData tests
// ============================================================================

#[test]
fn test_store_data_add_repository() {
    let state = create_test_state();

    {
        let mut store = state.store.lock().unwrap();
        let repo = create_test_repository("repo-1", "/path/to/repo", "my-repo");
        store.repositories.push(repo);
    }

    let store = state.store.lock().unwrap();
    assert_eq!(store.repositories.len(), 1);
    assert_eq!(store.repositories[0].name, "my-repo");
}

#[test]
fn test_store_data_remove_repository() {
    let state = create_test_state();

    {
        let mut store = state.store.lock().unwrap();
        store
            .repositories
            .push(create_test_repository("repo-1", "/path/1", "repo-1"));
        store
            .repositories
            .push(create_test_repository("repo-2", "/path/2", "repo-2"));
    }

    {
        let mut store = state.store.lock().unwrap();
        store.repositories.retain(|r| r.id != "repo-1");
    }

    let store = state.store.lock().unwrap();
    assert_eq!(store.repositories.len(), 1);
    assert_eq!(store.repositories[0].id, "repo-2");
}

#[test]
fn test_store_data_find_repository_by_id() {
    let state = create_test_state();

    {
        let mut store = state.store.lock().unwrap();
        store
            .repositories
            .push(create_test_repository("find-me", "/path/find", "find-repo"));
        store
            .repositories
            .push(create_test_repository("other", "/path/other", "other-repo"));
    }

    let store = state.store.lock().unwrap();
    let found = store.repositories.iter().find(|r| r.id == "find-me");
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "find-repo");
}

#[test]
fn test_store_data_find_repository_by_path() {
    let state = create_test_state();

    {
        let mut store = state.store.lock().unwrap();
        store.repositories.push(create_test_repository(
            "id-1",
            "/unique/path/repo",
            "unique-repo",
        ));
    }

    let store = state.store.lock().unwrap();
    let found = store
        .repositories
        .iter()
        .find(|r| r.path == "/unique/path/repo");
    assert!(found.is_some());
}

#[test]
fn test_store_data_duplicate_path_check() {
    let state = create_test_state();
    let path = "/duplicate/path";

    {
        let mut store = state.store.lock().unwrap();
        store
            .repositories
            .push(create_test_repository("id-1", path, "repo-1"));
    }

    let store = state.store.lock().unwrap();
    let already_exists = store.repositories.iter().any(|r| r.path == path);
    assert!(already_exists);
}

// ============================================================================
// Repository worktree management tests
// ============================================================================

#[test]
fn test_repository_add_worktree() {
    let mut repo = create_test_repository("repo-1", "/path/repo", "my-repo");
    let worktree = create_test_worktree("wt-1", "feature-worktree", "/path/repo/feature");

    repo.worktrees.push(worktree);

    assert_eq!(repo.worktrees.len(), 1);
    assert_eq!(repo.worktrees[0].name, "feature-worktree");
}

#[test]
fn test_repository_remove_worktree() {
    let mut repo = create_test_repository("repo-1", "/path/repo", "my-repo");
    repo.worktrees
        .push(create_test_worktree("wt-1", "wt-1", "/path/1"));
    repo.worktrees
        .push(create_test_worktree("wt-2", "wt-2", "/path/2"));

    repo.worktrees.retain(|w| w.path != "/path/1");

    assert_eq!(repo.worktrees.len(), 1);
    assert_eq!(repo.worktrees[0].path, "/path/2");
}

#[test]
fn test_repository_update_worktree() {
    let mut repo = create_test_repository("repo-1", "/path/repo", "my-repo");
    repo.worktrees
        .push(create_test_worktree("wt-1", "old-name", "/path/wt"));

    // Find and update
    if let Some(wt) = repo.worktrees.iter_mut().find(|w| w.id == "wt-1") {
        wt.name = "new-name".to_string();
        wt.is_locked = true;
        wt.lock_reason = Some("Testing".to_string());
    }

    assert_eq!(repo.worktrees[0].name, "new-name");
    assert!(repo.worktrees[0].is_locked);
    assert_eq!(repo.worktrees[0].lock_reason, Some("Testing".to_string()));
}

#[test]
fn test_repository_find_worktree_by_path() {
    let mut repo = create_test_repository("repo-1", "/path/repo", "my-repo");
    repo.worktrees
        .push(create_test_worktree("wt-1", "wt-1", "/find/this/path"));
    repo.worktrees
        .push(create_test_worktree("wt-2", "wt-2", "/other/path"));

    let found = repo.worktrees.iter().find(|w| w.path == "/find/this/path");
    assert!(found.is_some());
    assert_eq!(found.unwrap().id, "wt-1");
}

// ============================================================================
// Concurrent access tests
// ============================================================================

#[test]
fn test_state_mutex_lock() {
    let state = create_test_state();

    // Should be able to lock and unlock multiple times
    {
        let _store = state.store.lock().unwrap();
    }
    {
        let _store = state.store.lock().unwrap();
    }
    {
        let store = state.store.lock().unwrap();
        assert!(store.repositories.is_empty());
    }
}

#[test]
fn test_state_modification_persists() {
    let state = create_test_state();

    {
        let mut store = state.store.lock().unwrap();
        store
            .repositories
            .push(create_test_repository("persist-test", "/path", "persist"));
    }

    // Changes should persist after lock is released
    let store = state.store.lock().unwrap();
    assert_eq!(store.repositories.len(), 1);
    assert_eq!(store.repositories[0].id, "persist-test");
}

// ============================================================================
// Integration with real git repo
// ============================================================================

#[test]
fn test_state_with_real_repository() {
    use crate::commands::worktree::{get_repository_name, is_git_repository, list_worktrees};

    let test_repo = TestRepo::new();
    let state = create_test_state();

    // Simulate adding a real repository
    let repo_path = test_repo.path_str();

    assert!(is_git_repository(&repo_path));

    let worktrees = list_worktrees(&repo_path).unwrap();
    let repo_name = get_repository_name(&repo_path);

    {
        let mut store = state.store.lock().unwrap();
        store.repositories.push(Repository {
            id: "real-repo".to_string(),
            path: repo_path.clone(),
            name: repo_name,
            worktrees,
            last_scanned: chrono::Utc::now().timestamp_millis(),
        });
    }

    let store = state.store.lock().unwrap();
    assert_eq!(store.repositories.len(), 1);
    assert!(!store.repositories[0].worktrees.is_empty());
}

#[test]
fn test_state_refresh_repository_worktrees() {
    use crate::commands::worktree::{create_worktree, list_worktrees};

    let test_repo = TestRepo::new();
    test_repo.create_branch("refresh-branch");
    let state = create_test_state();
    let repo_path = test_repo.path_str();

    // Add repository with initial worktrees
    {
        let worktrees = list_worktrees(&repo_path).unwrap();
        let mut store = state.store.lock().unwrap();
        store.repositories.push(Repository {
            id: "refresh-repo".to_string(),
            path: repo_path.clone(),
            name: "refresh-repo".to_string(),
            worktrees,
            last_scanned: 0,
        });
    }

    // Create a new worktree externally
    create_worktree(
        &repo_path,
        "new-wt",
        Some("refresh-branch"),
        None,
        None,
        false,
    )
    .unwrap();

    // Refresh the repository
    {
        let new_worktrees = list_worktrees(&repo_path).unwrap();
        let mut store = state.store.lock().unwrap();
        if let Some(repo) = store
            .repositories
            .iter_mut()
            .find(|r| r.id == "refresh-repo")
        {
            repo.worktrees = new_worktrees;
            repo.last_scanned = chrono::Utc::now().timestamp_millis();
        }
    }

    let store = state.store.lock().unwrap();
    let repo = store
        .repositories
        .iter()
        .find(|r| r.id == "refresh-repo")
        .unwrap();
    assert_eq!(repo.worktrees.len(), 2); // main + new-wt
}

// ============================================================================
// Serialization tests (for StoreData)
// ============================================================================

#[test]
fn test_store_data_serialization() {
    let mut store_data = StoreData::default();
    store_data
        .repositories
        .push(create_test_repository("ser-1", "/path/ser", "ser-repo"));
    store_data.repositories[0]
        .worktrees
        .push(create_test_worktree("wt-ser", "wt-ser", "/path/ser/wt"));

    // Serialize
    let json = serde_json::to_string(&store_data).unwrap();
    assert!(json.contains("ser-repo"));
    assert!(json.contains("wt-ser"));

    // Deserialize
    let deserialized: StoreData = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.repositories.len(), 1);
    assert_eq!(deserialized.repositories[0].worktrees.len(), 1);
}

#[test]
fn test_worktree_info_serialization() {
    let worktree = WorktreeInfo {
        id: "test-id".to_string(),
        name: "test-worktree".to_string(),
        path: "/test/path".to_string(),
        branch: Some("feature".to_string()),
        commit: Some("abc123".to_string()),
        is_main: false,
        is_locked: true,
        lock_reason: Some("Important work".to_string()),
        startup_script: Some("npm install".to_string()),
        script_executed: true,
        created_at: 1234567890,
    };

    let json = serde_json::to_string(&worktree).unwrap();
    let deserialized: WorktreeInfo = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.id, "test-id");
    assert_eq!(deserialized.name, "test-worktree");
    assert_eq!(deserialized.branch, Some("feature".to_string()));
    assert!(deserialized.is_locked);
    assert_eq!(deserialized.lock_reason, Some("Important work".to_string()));
}

#[test]
fn test_repository_serialization() {
    let repo = Repository {
        id: "repo-id".to_string(),
        path: "/repo/path".to_string(),
        name: "my-repo".to_string(),
        worktrees: vec![create_test_worktree("wt-1", "wt-1", "/wt/path")],
        last_scanned: 9876543210,
    };

    let json = serde_json::to_string(&repo).unwrap();
    let deserialized: Repository = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.id, "repo-id");
    assert_eq!(deserialized.name, "my-repo");
    assert_eq!(deserialized.worktrees.len(), 1);
    assert_eq!(deserialized.last_scanned, 9876543210);
}
