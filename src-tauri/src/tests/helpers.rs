//! Shared test utilities.

use std::path::Path;
use std::process::Command;
use tempfile::TempDir;

/// A test fixture that creates a temporary git repository with some initial setup.
/// The repository is automatically cleaned up when the fixture is dropped.
pub struct TestRepo {
    pub temp_dir: TempDir,
}

impl TestRepo {
    /// Creates a new temporary git repository with:
    /// - An initial commit
    /// - A file called "test.txt"
    pub fn new() -> Self {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let repo_path = temp_dir.path();

        // Initialize git repo
        run_git(&["init"], repo_path);

        // Configure git user for commits
        run_git(&["config", "user.email", "test@example.com"], repo_path);
        run_git(&["config", "user.name", "Test User"], repo_path);

        // Create initial file and commit
        std::fs::write(repo_path.join("test.txt"), "initial content").unwrap();
        run_git(&["add", "."], repo_path);
        run_git(&["commit", "-m", "Initial commit"], repo_path);

        TestRepo { temp_dir }
    }

    /// Creates a new temporary git repository with multiple branches.
    pub fn with_branches(branch_names: &[&str]) -> Self {
        let repo = Self::new();
        let repo_path = repo.path();

        for branch_name in branch_names {
            run_git(&["branch", branch_name], repo_path);
        }

        repo
    }

    /// Returns the path to the repository root.
    pub fn path(&self) -> &Path {
        self.temp_dir.path()
    }

    /// Returns the path as a string.
    pub fn path_str(&self) -> String {
        self.temp_dir.path().to_string_lossy().to_string()
    }

    /// Creates a new commit with a given message.
    pub fn commit(&self, message: &str) {
        let file_path = self
            .path()
            .join(format!("{}.txt", message.replace(' ', "_")));
        std::fs::write(&file_path, message).unwrap();
        run_git(&["add", "."], self.path());
        run_git(&["commit", "-m", message], self.path());
    }

    /// Creates a new branch.
    pub fn create_branch(&self, name: &str) {
        run_git(&["branch", name], self.path());
    }

    /// Checks out a branch.
    pub fn checkout(&self, branch: &str) {
        run_git(&["checkout", branch], self.path());
    }

    /// Gets the current branch name.
    pub fn current_branch(&self) -> String {
        let output = Command::new("git")
            .args(["symbolic-ref", "--short", "HEAD"])
            .current_dir(self.path())
            .output()
            .expect("Failed to get current branch");
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }
}

/// Helper function to run git commands.
fn run_git(args: &[&str], cwd: &Path) {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .expect("Failed to execute git command");

    if !output.status.success() {
        panic!(
            "Git command failed: git {}\nstderr: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

/// Creates a non-git directory for testing error cases.
pub fn create_non_git_dir() -> TempDir {
    TempDir::new().expect("Failed to create temp directory")
}
