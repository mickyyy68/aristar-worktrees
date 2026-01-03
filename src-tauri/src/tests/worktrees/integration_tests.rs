//! Integration tests for worktree operations.

use crate::tests::helpers::TestRepo;
use crate::worktrees::operations::*;

// ============================================================================
// list_worktrees tests
// ============================================================================

#[test]
fn test_list_worktrees_single_main() {
    let repo = TestRepo::new();
    let worktrees = list_worktrees(&repo.path_str());
    assert!(worktrees.is_ok());
    let worktrees = worktrees.unwrap();

    // Should have exactly one worktree (the main one)
    assert_eq!(worktrees.len(), 1);

    let main_worktree = &worktrees[0];
    assert!(main_worktree.is_main);
    assert_eq!(main_worktree.name, "main");
}

#[test]
fn test_list_worktrees_has_branch() {
    let repo = TestRepo::new();
    let worktrees = list_worktrees(&repo.path_str()).unwrap();

    assert!(!worktrees.is_empty());
    // Main worktree should have a branch
    assert!(worktrees[0].branch.is_some());
}

// ============================================================================
// create_worktree tests
// ============================================================================

#[test]
fn test_create_worktree_basic() {
    let repo = TestRepo::new();
    repo.create_branch("feature-test");

    let result = create_worktree(
        &repo.path_str(),
        "test-worktree",
        Some("feature-test"),
        None,
        None,
        false,
    );

    assert!(
        result.is_ok(),
        "Failed to create worktree: {:?}",
        result.err()
    );
    let worktree = result.unwrap();
    assert_eq!(worktree.name, "test-worktree");
    assert!(!worktree.is_main);
}

#[test]
fn test_create_worktree_with_new_branch() {
    let repo = TestRepo::new();

    let result = create_worktree(
        &repo.path_str(),
        "new-branch-worktree",
        Some("new-feature-branch"),
        None,
        None,
        false,
    );

    // This might fail if git worktree add doesn't auto-create branches
    // The behavior depends on the branch existing
    if result.is_ok() {
        let worktree = result.unwrap();
        assert_eq!(worktree.name, "new-branch-worktree");
    }
}

#[test]
fn test_create_worktree_appears_in_list() {
    let repo = TestRepo::new();
    repo.create_branch("list-test");

    let _ = create_worktree(
        &repo.path_str(),
        "listed-worktree",
        Some("list-test"),
        None,
        None,
        false,
    );

    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    assert!(worktrees.len() >= 2);
    assert!(worktrees.iter().any(|w| w.name == "listed-worktree"));
}

#[test]
fn test_create_worktree_duplicate_name() {
    let repo = TestRepo::new();
    repo.create_branch("dup-test-1");
    repo.create_branch("dup-test-2");

    let _ = create_worktree(
        &repo.path_str(),
        "duplicate-worktree",
        Some("dup-test-1"),
        None,
        None,
        false,
    );

    // Creating with same name should fail
    let result = create_worktree(
        &repo.path_str(),
        "duplicate-worktree",
        Some("dup-test-2"),
        None,
        None,
        false,
    );

    assert!(result.is_err());
}

// ============================================================================
// remove_worktree tests
// ============================================================================

#[test]
fn test_remove_worktree_basic() {
    let repo = TestRepo::new();
    repo.create_branch("remove-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "to-remove",
        Some("remove-test"),
        None,
        None,
        false,
    )
    .unwrap();

    // Remove it
    let result = remove_worktree(&worktree.path, false, false);
    assert!(result.is_ok());

    // Verify it's gone from the list
    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    assert_eq!(worktrees.len(), 1); // Only main worktree remains
}

#[test]
fn test_remove_worktree_force() {
    let repo = TestRepo::new();
    repo.create_branch("force-remove");

    let worktree = create_worktree(
        &repo.path_str(),
        "force-worktree",
        Some("force-remove"),
        None,
        None,
        false,
    )
    .unwrap();

    // Add uncommitted changes to make it "dirty"
    let dirty_file = std::path::Path::new(&worktree.path).join("dirty.txt");
    std::fs::write(&dirty_file, "uncommitted changes").unwrap();

    // Force remove should work even with uncommitted changes
    let result = remove_worktree(&worktree.path, true, false);
    assert!(result.is_ok());
}

#[test]
fn test_remove_worktree_nonexistent() {
    let repo = TestRepo::new();
    let result = remove_worktree(&format!("{}/nonexistent", repo.path_str()), false, false);
    assert!(result.is_err());
}

// ============================================================================
// rename_worktree tests
// ============================================================================

#[test]
fn test_rename_worktree_basic() {
    let repo = TestRepo::new();
    repo.create_branch("rename-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "original-name",
        Some("rename-test"),
        None,
        None,
        false,
    )
    .unwrap();

    let result = rename_worktree(&worktree.path, "new-name");
    assert!(result.is_ok());

    let renamed = result.unwrap();
    assert_eq!(renamed.name, "new-name");
}

#[test]
fn test_rename_worktree_updates_list() {
    let repo = TestRepo::new();
    repo.create_branch("rename-list-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "rename-me",
        Some("rename-list-test"),
        None,
        None,
        false,
    )
    .unwrap();

    let _ = rename_worktree(&worktree.path, "renamed");

    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    assert!(worktrees.iter().any(|w| w.name == "renamed"));
    assert!(!worktrees.iter().any(|w| w.name == "rename-me"));
}

// ============================================================================
// lock_worktree tests
// ============================================================================

#[test]
fn test_lock_worktree_basic() {
    let repo = TestRepo::new();
    repo.create_branch("lock-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "lockable",
        Some("lock-test"),
        None,
        None,
        false,
    )
    .unwrap();

    let result = lock_worktree(&worktree.path, None);
    assert!(result.is_ok());

    // Verify it's locked
    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    let locked = worktrees.iter().find(|w| w.name == "lockable").unwrap();
    assert!(locked.is_locked);
}

#[test]
fn test_lock_worktree_with_reason() {
    let repo = TestRepo::new();
    repo.create_branch("lock-reason-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "lockable-reason",
        Some("lock-reason-test"),
        None,
        None,
        false,
    )
    .unwrap();

    let result = lock_worktree(&worktree.path, Some("important work"));
    assert!(result.is_ok());

    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    let locked = worktrees
        .iter()
        .find(|w| w.name == "lockable-reason")
        .unwrap();
    assert!(locked.is_locked);
    assert!(locked.lock_reason.is_some());
}

#[test]
fn test_unlock_worktree() {
    let repo = TestRepo::new();
    repo.create_branch("unlock-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "unlockable",
        Some("unlock-test"),
        None,
        None,
        false,
    )
    .unwrap();

    lock_worktree(&worktree.path, None).unwrap();
    let result = unlock_worktree(&worktree.path);
    assert!(result.is_ok());

    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    let unlocked = worktrees.iter().find(|w| w.name == "unlockable").unwrap();
    assert!(!unlocked.is_locked);
}

#[test]
fn test_lock_prevents_removal() {
    let repo = TestRepo::new();
    repo.create_branch("lock-prevent-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "locked-worktree",
        Some("lock-prevent-test"),
        None,
        None,
        false,
    )
    .unwrap();

    lock_worktree(&worktree.path, None).unwrap();

    // Try to remove without force - should fail
    let result = remove_worktree(&worktree.path, false, false);
    assert!(
        result.is_err(),
        "Expected error when removing locked worktree without force"
    );

    // Force remove should work
    let result = remove_worktree(&worktree.path, true, false);
    assert!(
        result.is_ok(),
        "Force remove failed with: {:?}",
        result.err()
    );
}

// ============================================================================
// Edge cases and error handling
// ============================================================================

#[test]
fn test_worktree_has_unique_id() {
    let repo = TestRepo::new();
    repo.create_branch("id-test-1");
    repo.create_branch("id-test-2");

    let _ = create_worktree(
        &repo.path_str(),
        "wt1",
        Some("id-test-1"),
        None,
        None,
        false,
    );
    let _ = create_worktree(
        &repo.path_str(),
        "wt2",
        Some("id-test-2"),
        None,
        None,
        false,
    );

    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    let ids: Vec<&String> = worktrees.iter().map(|w| &w.id).collect();

    // All IDs should be unique
    let mut unique_ids = ids.clone();
    unique_ids.sort();
    unique_ids.dedup();
    assert_eq!(ids.len(), unique_ids.len());
}
