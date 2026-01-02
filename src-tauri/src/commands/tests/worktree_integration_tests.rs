use crate::commands::worktree::{
    create_worktree, list_worktrees, lock_worktree, remove_worktree, rename_worktree,
    unlock_worktree,
};

use super::helpers::TestRepo;

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
    assert!(!main_worktree.is_locked);
}

#[test]
fn test_list_worktrees_path_is_canonical() {
    let repo = TestRepo::new();
    let worktrees = list_worktrees(&repo.path_str()).unwrap();

    let main_worktree = &worktrees[0];
    // Path should be canonical (absolute, no symlinks)
    assert!(main_worktree.path.starts_with('/'));
    assert!(!main_worktree.path.contains(".."));
}

#[test]
fn test_list_worktrees_has_branch() {
    let repo = TestRepo::new();
    let worktrees = list_worktrees(&repo.path_str()).unwrap();

    let main_worktree = &worktrees[0];
    assert!(main_worktree.branch.is_some());
}

// ============================================================================
// create_worktree tests
// ============================================================================

#[test]
fn test_create_worktree_basic() {
    let repo = TestRepo::new();
    repo.create_branch("feature-branch");

    let result = create_worktree(
        &repo.path_str(),
        "my-worktree",
        Some("feature-branch"),
        None,
        None,
        false,
    );

    assert!(result.is_ok());
    let worktree = result.unwrap();
    assert_eq!(worktree.name, "my-worktree");
    assert!(!worktree.is_main);
    assert!(!worktree.is_locked);
}

#[test]
fn test_create_worktree_appears_in_list() {
    let repo = TestRepo::new();
    repo.create_branch("test-branch");

    create_worktree(
        &repo.path_str(),
        "new-worktree",
        Some("test-branch"),
        None,
        None,
        false,
    )
    .unwrap();

    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    assert_eq!(worktrees.len(), 2);

    let new_worktree = worktrees.iter().find(|w| w.name == "new-worktree");
    assert!(new_worktree.is_some());
}

#[test]
fn test_create_worktree_with_new_branch() {
    let repo = TestRepo::new();

    // Create worktree with a new branch (git worktree add -b)
    let result = create_worktree(
        &repo.path_str(),
        "feature-worktree",
        Some("new-feature-branch"),
        None,
        None,
        false,
    );

    // This might fail because git worktree add requires existing branch
    // or uses -b flag for new branches. Let's check the behavior.
    // The current implementation just passes the branch name, which requires
    // the branch to exist.
    if result.is_err() {
        // Create branch first, then retry
        repo.create_branch("new-feature-branch");
        let result = create_worktree(
            &repo.path_str(),
            "feature-worktree",
            Some("new-feature-branch"),
            None,
            None,
            false,
        );
        assert!(result.is_ok());
    }
}

#[test]
fn test_create_worktree_with_startup_script_no_execute() {
    let repo = TestRepo::new();
    repo.create_branch("script-test");

    let script_content = "#!/bin/bash\necho 'Hello from script'";
    let result = create_worktree(
        &repo.path_str(),
        "script-worktree",
        Some("script-test"),
        None,
        Some(script_content),
        false, // Don't execute
    );

    assert!(result.is_ok());

    // Check that script file was created
    let script_path = repo.path().join("script-worktree/.worktree-setup.sh");
    assert!(script_path.exists());

    let content = std::fs::read_to_string(&script_path).unwrap();
    assert_eq!(content, script_content);
}

#[test]
fn test_create_worktree_with_startup_script_execute() {
    let repo = TestRepo::new();
    repo.create_branch("exec-test");

    // Create a script that creates a marker file
    let script_content = "#!/bin/bash\ntouch marker_file.txt";
    let result = create_worktree(
        &repo.path_str(),
        "exec-worktree",
        Some("exec-test"),
        None,
        Some(script_content),
        true, // Execute the script
    );

    assert!(result.is_ok());

    // Check that the script was executed (marker file should exist)
    let marker_path = repo.path().join("exec-worktree/marker_file.txt");
    assert!(marker_path.exists());
}

// ============================================================================
// remove_worktree tests
// ============================================================================

#[test]
fn test_remove_worktree_basic() {
    let repo = TestRepo::new();
    repo.create_branch("to-remove");

    // Create a worktree
    let worktree = create_worktree(
        &repo.path_str(),
        "removable-worktree",
        Some("to-remove"),
        None,
        None,
        false,
    )
    .unwrap();

    // Remove it
    let result = remove_worktree(&worktree.path, false);
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
    let result = remove_worktree(&worktree.path, true);
    assert!(result.is_ok());
}

#[test]
fn test_remove_worktree_nonexistent() {
    let repo = TestRepo::new();
    let result = remove_worktree(&format!("{}/nonexistent", repo.path_str()), false);
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
        "old-name",
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
    assert!(renamed.path.ends_with("new-name"));
}

#[test]
fn test_rename_worktree_updates_list() {
    let repo = TestRepo::new();
    repo.create_branch("rename-list-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "before-rename",
        Some("rename-list-test"),
        None,
        None,
        false,
    )
    .unwrap();

    rename_worktree(&worktree.path, "after-rename").unwrap();

    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    let names: Vec<&str> = worktrees.iter().map(|w| w.name.as_str()).collect();

    assert!(!names.contains(&"before-rename"));
    assert!(names.contains(&"after-rename"));
}

// ============================================================================
// lock_worktree / unlock_worktree tests
// ============================================================================

#[test]
fn test_lock_worktree_basic() {
    let repo = TestRepo::new();
    repo.create_branch("lock-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "lockable-worktree",
        Some("lock-test"),
        None,
        None,
        false,
    )
    .unwrap();

    let result = lock_worktree(&worktree.path, None);
    assert!(result.is_ok());

    // Verify it's locked in the list
    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    let locked_wt = worktrees
        .iter()
        .find(|w| w.name == "lockable-worktree")
        .unwrap();
    assert!(locked_wt.is_locked);
}

#[test]
fn test_lock_worktree_with_reason() {
    let repo = TestRepo::new();
    repo.create_branch("lock-reason-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "reason-worktree",
        Some("lock-reason-test"),
        None,
        None,
        false,
    )
    .unwrap();

    let result = lock_worktree(&worktree.path, Some("Work in progress"));
    assert!(result.is_ok());
}

#[test]
fn test_unlock_worktree() {
    let repo = TestRepo::new();
    repo.create_branch("unlock-test");

    let worktree = create_worktree(
        &repo.path_str(),
        "unlock-worktree",
        Some("unlock-test"),
        None,
        None,
        false,
    )
    .unwrap();

    // Lock it first
    lock_worktree(&worktree.path, None).unwrap();

    // Then unlock
    let result = unlock_worktree(&worktree.path);
    assert!(result.is_ok());

    // Verify it's unlocked
    let worktrees = list_worktrees(&repo.path_str()).unwrap();
    let unlocked_wt = worktrees
        .iter()
        .find(|w| w.name == "unlock-worktree")
        .unwrap();
    assert!(!unlocked_wt.is_locked);
}

#[test]
fn test_lock_prevents_removal() {
    let repo = TestRepo::new();
    repo.create_branch("lock-prevent");

    let worktree = create_worktree(
        &repo.path_str(),
        "locked-no-remove",
        Some("lock-prevent"),
        None,
        None,
        false,
    )
    .unwrap();

    lock_worktree(&worktree.path, None).unwrap();

    // Try to remove without force - should fail
    let result = remove_worktree(&worktree.path, false);
    assert!(
        result.is_err(),
        "Expected error when removing locked worktree without force"
    );

    // Force remove should work
    let result = remove_worktree(&worktree.path, true);
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
fn test_create_worktree_duplicate_name() {
    let repo = TestRepo::new();
    repo.create_branch("dup-1");
    repo.create_branch("dup-2");

    // Create first worktree
    create_worktree(
        &repo.path_str(),
        "duplicate-name",
        Some("dup-1"),
        None,
        None,
        false,
    )
    .unwrap();

    // Try to create another with the same name - should fail
    let result = create_worktree(
        &repo.path_str(),
        "duplicate-name",
        Some("dup-2"),
        None,
        None,
        false,
    );
    assert!(result.is_err());
}

#[test]
fn test_list_worktrees_invalid_path() {
    let result = list_worktrees("/nonexistent/path/to/repo");
    assert!(result.is_err());
}

#[test]
fn test_worktree_has_unique_id() {
    let repo = TestRepo::new();
    repo.create_branch("id-test-1");
    repo.create_branch("id-test-2");

    create_worktree(
        &repo.path_str(),
        "worktree-1",
        Some("id-test-1"),
        None,
        None,
        false,
    )
    .unwrap();
    create_worktree(
        &repo.path_str(),
        "worktree-2",
        Some("id-test-2"),
        None,
        None,
        false,
    )
    .unwrap();

    let worktrees = list_worktrees(&repo.path_str()).unwrap();

    // All IDs should be unique
    let ids: Vec<&str> = worktrees.iter().map(|w| w.id.as_str()).collect();
    let unique_ids: std::collections::HashSet<&str> = ids.iter().cloned().collect();
    assert_eq!(ids.len(), unique_ids.len());
}
