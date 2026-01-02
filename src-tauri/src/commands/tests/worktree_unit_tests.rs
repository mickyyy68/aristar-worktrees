use crate::commands::worktree::{get_repository_name, is_git_repository, run_git_command};

use super::helpers::{create_non_git_dir, TestRepo};

// ============================================================================
// get_repository_name tests
// ============================================================================

#[test]
fn test_get_repository_name_simple_path() {
    let name = get_repository_name("/Users/test/projects/my-repo");
    assert_eq!(name, "my-repo");
}

#[test]
fn test_get_repository_name_with_trailing_slash() {
    // Note: Path::file_name returns None for paths ending with /
    // This tests the current behavior
    let name = get_repository_name("/Users/test/projects/my-repo/");
    // When path ends with /, file_name() returns empty string or the last component
    // depending on implementation. Let's verify the actual behavior.
    assert!(!name.is_empty());
}

#[test]
fn test_get_repository_name_root_path() {
    let name = get_repository_name("/");
    // Root path has no file_name, should return "Unknown"
    assert_eq!(name, "Unknown");
}

#[test]
fn test_get_repository_name_nested_path() {
    let name = get_repository_name("/very/deeply/nested/path/to/repository");
    assert_eq!(name, "repository");
}

#[test]
fn test_get_repository_name_with_special_chars() {
    let name = get_repository_name("/path/to/my-awesome_repo.v2");
    assert_eq!(name, "my-awesome_repo.v2");
}

// ============================================================================
// is_git_repository tests
// ============================================================================

#[test]
fn test_is_git_repository_valid_repo() {
    let repo = TestRepo::new();
    assert!(is_git_repository(&repo.path_str()));
}

#[test]
fn test_is_git_repository_non_git_directory() {
    let non_git_dir = create_non_git_dir();
    assert!(!is_git_repository(&non_git_dir.path().to_string_lossy()));
}

#[test]
fn test_is_git_repository_nonexistent_path() {
    assert!(!is_git_repository("/nonexistent/path/that/does/not/exist"));
}

#[test]
fn test_is_git_repository_subdirectory() {
    let repo = TestRepo::new();
    let subdir = repo.path().join("subdir");
    std::fs::create_dir(&subdir).unwrap();

    // A subdirectory of a git repo is not itself a git repository root
    // (no .git folder directly in it)
    assert!(!is_git_repository(&subdir.to_string_lossy()));
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
fn test_run_git_command_with_output() {
    let repo = TestRepo::new();
    let result = run_git_command(&["rev-parse", "HEAD"], &repo.path_str());
    assert!(result.is_ok());

    let output = result.unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    // Should be a 40-character SHA
    assert_eq!(stdout.trim().len(), 40);
}

#[test]
fn test_run_git_command_failure() {
    let repo = TestRepo::new();
    // Try to checkout a non-existent branch
    let result = run_git_command(&["checkout", "nonexistent-branch-xyz"], &repo.path_str());
    assert!(result.is_err());
}

#[test]
fn test_run_git_command_invalid_directory() {
    let result = run_git_command(&["status"], "/nonexistent/path");
    assert!(result.is_err());
}

// ============================================================================
// get_current_branch tests
// ============================================================================

use crate::commands::worktree::get_current_branch;

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
    let repo = TestRepo::with_branches(&["feature-branch"]);
    repo.checkout("feature-branch");

    let branch = get_current_branch(&repo.path_str());
    assert!(branch.is_ok());
    assert_eq!(branch.unwrap(), "feature-branch");
}

#[test]
fn test_get_current_branch_invalid_repo() {
    let non_git_dir = create_non_git_dir();
    let result = get_current_branch(&non_git_dir.path().to_string_lossy());
    assert!(result.is_err());
}

// ============================================================================
// get_branches tests
// ============================================================================

use crate::commands::worktree::get_branches;

#[test]
fn test_get_branches_default_repo() {
    let repo = TestRepo::new();
    let branches = get_branches(&repo.path_str());
    assert!(branches.is_ok());

    let branches = branches.unwrap();
    assert!(!branches.is_empty());

    // Should have at least the default branch
    let has_main_or_master = branches
        .iter()
        .any(|b| b.name == "main" || b.name == "master");
    assert!(has_main_or_master);
}

#[test]
fn test_get_branches_multiple_branches() {
    let repo = TestRepo::with_branches(&["feature-1", "feature-2", "bugfix"]);
    let branches = get_branches(&repo.path_str());
    assert!(branches.is_ok());

    let branches = branches.unwrap();
    let branch_names: Vec<&str> = branches.iter().map(|b| b.name.as_str()).collect();

    assert!(branch_names.contains(&"feature-1"));
    assert!(branch_names.contains(&"feature-2"));
    assert!(branch_names.contains(&"bugfix"));
}

#[test]
fn test_get_branches_current_branch_marked() {
    let repo = TestRepo::with_branches(&["other-branch"]);
    let branches = get_branches(&repo.path_str()).unwrap();

    // Exactly one branch should be marked as current
    let current_branches: Vec<_> = branches.iter().filter(|b| b.is_current).collect();
    assert_eq!(current_branches.len(), 1);
}

#[test]
fn test_get_branches_local_branches_not_remote() {
    let repo = TestRepo::with_branches(&["local-branch"]);
    let branches = get_branches(&repo.path_str()).unwrap();

    let local_branch = branches.iter().find(|b| b.name == "local-branch");
    assert!(local_branch.is_some());
    assert!(!local_branch.unwrap().is_remote);
}
