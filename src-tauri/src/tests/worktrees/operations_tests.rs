//! Unit tests for worktree operations.

use crate::tests::helpers::{create_non_git_dir, TestRepo};
use crate::worktrees::operations::*;

// ============================================================================
// is_git_repository tests
// ============================================================================

#[test]
fn test_is_git_repository_valid_repo() {
    let repo = TestRepo::new();
    assert!(is_git_repository(&repo.path_str()));
}

#[test]
fn test_is_git_repository_nonexistent_path() {
    assert!(!is_git_repository("/nonexistent/path/to/repo"));
}

#[test]
fn test_is_git_repository_non_git_directory() {
    let temp = create_non_git_dir();
    assert!(!is_git_repository(temp.path().to_str().unwrap()));
}

#[test]
fn test_is_git_repository_subdirectory() {
    let repo = TestRepo::new();
    let subdir = repo.path().join("subdir");
    std::fs::create_dir(&subdir).unwrap();

    // Subdirectory of a git repo should still be detected
    // (the function checks for .git at the exact path, so this should fail)
    assert!(!is_git_repository(subdir.to_str().unwrap()));
}

// ============================================================================
// get_repository_name tests
// ============================================================================

#[test]
fn test_get_repository_name_simple_path() {
    assert_eq!(get_repository_name("/path/to/my-repo"), "my-repo");
}

#[test]
fn test_get_repository_name_nested_path() {
    assert_eq!(
        get_repository_name("/home/user/projects/deep/nested/repo-name"),
        "repo-name"
    );
}

#[test]
fn test_get_repository_name_with_trailing_slash() {
    // Path::file_name returns None for paths ending in /
    // So this should return "Unknown" or handle it gracefully
    let result = get_repository_name("/path/to/repo/");
    assert!(!result.is_empty());
}

#[test]
fn test_get_repository_name_root_path() {
    // Edge case: root path
    let result = get_repository_name("/");
    assert!(!result.is_empty());
}

#[test]
fn test_get_repository_name_with_special_chars() {
    assert_eq!(
        get_repository_name("/path/to/repo-with_special.chars"),
        "repo-with_special.chars"
    );
}

// ============================================================================
// run_git_command tests
// ============================================================================

#[test]
fn test_run_git_command_success() {
    let repo = TestRepo::new();
    let result = run_git_command(&["status"], &repo.path_str());
    assert!(result.is_ok());
}

#[test]
fn test_run_git_command_failure() {
    let repo = TestRepo::new();
    // Invalid git command should fail
    let result = run_git_command(&["invalid-command"], &repo.path_str());
    assert!(result.is_err());
}

#[test]
fn test_run_git_command_invalid_directory() {
    let result = run_git_command(&["status"], "/nonexistent/path");
    assert!(result.is_err());
}

#[test]
fn test_run_git_command_with_output() {
    let repo = TestRepo::new();
    let result = run_git_command(&["rev-parse", "--show-toplevel"], &repo.path_str());
    assert!(result.is_ok());
    let output = result.unwrap();
    assert!(!output.stdout.is_empty());
}

// ============================================================================
// get_current_branch tests
// ============================================================================

#[test]
fn test_get_current_branch_default() {
    let repo = TestRepo::new();
    let branch = get_current_branch(&repo.path_str());
    assert!(branch.is_ok());
    // Default branch is typically "main" or "master"
    let branch_name = branch.unwrap();
    assert!(branch_name == "main" || branch_name == "master");
}

#[test]
fn test_get_current_branch_after_checkout() {
    let repo = TestRepo::new();
    repo.create_branch("feature-branch");
    repo.checkout("feature-branch");

    let branch = get_current_branch(&repo.path_str());
    assert!(branch.is_ok());
    assert_eq!(branch.unwrap(), "feature-branch");
}

#[test]
fn test_get_current_branch_invalid_repo() {
    let result = get_current_branch("/nonexistent/path");
    assert!(result.is_err());
}

// ============================================================================
// get_branches tests
// ============================================================================

#[test]
fn test_get_branches_default_repo() {
    let repo = TestRepo::new();
    let branches = get_branches(&repo.path_str());
    assert!(branches.is_ok());
    let branches = branches.unwrap();
    assert!(!branches.is_empty());
}

#[test]
fn test_get_branches_multiple_branches() {
    let repo = TestRepo::with_branches(&["feature-1", "feature-2", "bugfix"]);
    let branches = get_branches(&repo.path_str());
    assert!(branches.is_ok());
    let branches = branches.unwrap();
    // Should have main/master + 3 feature branches
    assert!(branches.len() >= 4);
}

#[test]
fn test_get_branches_current_branch_marked() {
    let repo = TestRepo::new();
    repo.create_branch("feature-branch");
    repo.checkout("feature-branch");

    let branches = get_branches(&repo.path_str());
    assert!(branches.is_ok());
    let branches = branches.unwrap();

    let current = branches.iter().find(|b| b.is_current);
    assert!(current.is_some());
    assert_eq!(current.unwrap().name, "feature-branch");
}

#[test]
fn test_get_branches_local_branches_not_remote() {
    let repo = TestRepo::new();
    let branches = get_branches(&repo.path_str());
    assert!(branches.is_ok());
    let branches = branches.unwrap();

    // All branches should be local (no remote in test repo)
    for branch in &branches {
        assert!(!branch.is_remote);
    }
}
