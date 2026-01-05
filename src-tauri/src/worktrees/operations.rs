//! Git worktree operations.
//!
//! Core functions for working with git worktrees - listing, creating, removing, etc.

use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

use crate::core::get_aristar_worktrees_base;

use super::types::{BranchInfo, CommitInfo, WorktreeInfo};

// ============ Path Security ============

/// Validate that a path is within an allowed base directory.
/// This prevents path traversal attacks where user input could escape
/// to arbitrary filesystem locations.
///
/// # Arguments
/// * `path` - The path to validate (can be relative or absolute)
/// * `allowed_bases` - List of allowed base directories
///
/// # Returns
/// * `Ok(PathBuf)` - The canonicalized path if valid
/// * `Err(String)` - Error message if path traversal detected
pub fn validate_path_within_bases(path: &Path, allowed_bases: &[PathBuf]) -> Result<PathBuf, String> {
    // For paths that don't exist yet, we need to check the parent
    let check_path = if path.exists() {
        path.canonicalize().map_err(|e| format!("Failed to resolve path: {}", e))?
    } else {
        // Path doesn't exist yet - check parent and combine with filename
        let parent = path.parent().ok_or("Path has no parent directory")?;
        let filename = path.file_name().ok_or("Path has no filename")?;
        
        // Ensure parent exists or create it, then canonicalize
        if !parent.exists() {
            // Walk up to find existing ancestor
            let mut ancestor = parent.to_path_buf();
            while !ancestor.exists() {
                ancestor = ancestor.parent()
                    .ok_or("Cannot find existing ancestor directory")?
                    .to_path_buf();
            }
            let canonical_ancestor = ancestor.canonicalize()
                .map_err(|e| format!("Failed to resolve ancestor: {}", e))?;
            
            // Check ancestor is in allowed bases
            if !allowed_bases.iter().any(|base| {
                base.canonicalize().ok()
                    .map(|cb| canonical_ancestor.starts_with(&cb))
                    .unwrap_or(false)
            }) {
                return Err(format!(
                    "Path traversal detected: {} is not within allowed directories",
                    path.display()
                ));
            }
            
            // Build expected canonical path
            let relative_from_ancestor = parent.strip_prefix(&ancestor).unwrap_or(parent);
            canonical_ancestor.join(relative_from_ancestor).join(filename)
        } else {
            let canonical_parent = parent.canonicalize()
                .map_err(|e| format!("Failed to resolve parent: {}", e))?;
            canonical_parent.join(filename)
        }
    };

    // Verify the path is within one of the allowed bases
    let is_allowed = allowed_bases.iter().any(|base| {
        base.canonicalize().ok()
            .map(|canonical_base| check_path.starts_with(&canonical_base))
            .unwrap_or(false)
    });

    if !is_allowed {
        return Err(format!(
            "Path traversal detected: {} is not within allowed directories",
            path.display()
        ));
    }

    Ok(check_path)
}

/// Get the list of allowed base directories for worktree operations.
/// This includes:
/// - ~/.aristar-worktrees (our managed directory)
/// - User's home directory (for repos in Documents, Projects, etc.)
pub fn get_allowed_worktree_bases() -> Vec<PathBuf> {
    let mut bases = vec![get_aristar_worktrees_base()];
    
    // Also allow home directory for user repos
    if let Some(home) = dirs::home_dir() {
        bases.push(home);
    }
    
    bases
}

/// Get the repository name from its path.
pub fn get_repository_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

/// Generate a hash for the repository path (first 8 hex chars of SHA256).
pub fn get_repo_hash(repo_path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(repo_path.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..4]) // First 4 bytes = 8 hex chars
}

/// Get the worktree base directory for a specific repository.
pub fn get_worktree_base_for_repo(repo_path: &str) -> PathBuf {
    get_aristar_worktrees_base().join(get_repo_hash(repo_path))
}

/// Ensure the repo info file exists in the worktree base directory.
pub fn ensure_repo_info(repo_path: &str) -> Result<(), String> {
    let base = get_worktree_base_for_repo(repo_path);
    std::fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    let info_file = base.join(".aristar-repo-info.json");
    if !info_file.exists() {
        let info = serde_json::json!({"originalPath": repo_path});
        std::fs::write(&info_file, info.to_string()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Check if a path is a git repository.
pub fn is_git_repository(path: &str) -> bool {
    let git_path = format!("{}/.git", path);
    Path::new(&git_path).exists() || Path::new(path).join(".git").is_dir()
}

/// Run a git command in the specified directory (synchronous version).
/// NOTE: For Tauri commands, prefer `run_git_command_async` to avoid blocking the main thread.
pub fn run_git_command(args: &[&str], cwd: &str) -> Result<std::process::Output, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(output)
}

/// Run a git command asynchronously without blocking the Tauri main thread.
/// This wraps the blocking git command in tokio::task::spawn_blocking.
#[allow(dead_code)]
pub async fn run_git_command_async(
    args: Vec<String>,
    cwd: String,
) -> Result<std::process::Output, String> {
    tokio::task::spawn_blocking(move || {
        let output = Command::new("git")
            .args(&args)
            .current_dir(&cwd)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(stderr.to_string());
        }

        Ok(output)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get the current branch name for a repository.
pub fn get_current_branch(repo_path: &str) -> Result<String, String> {
    let output = run_git_command(&["symbolic-ref", "--short", "HEAD"], repo_path)?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Get all branches for a repository.
pub fn get_branches(repo_path: &str) -> Result<Vec<BranchInfo>, String> {
    let output = run_git_command(&["branch", "-a", "--format=%(refname:short)"], repo_path)?;

    let current_branch = get_current_branch(repo_path).ok();
    let branches_str = String::from_utf8_lossy(&output.stdout);

    let branches: Vec<BranchInfo> = branches_str
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let is_remote = line.starts_with("remotes/");
            let name = if is_remote {
                line.strip_prefix("remotes/").unwrap_or(line).to_string()
            } else {
                line.to_string()
            };

            BranchInfo {
                name: name.clone(),
                is_current: Some(name.as_str()) == current_branch.as_deref(),
                is_remote,
            }
        })
        .collect();

    Ok(branches)
}

/// Get recent commits for a repository.
pub fn get_commits(repo_path: &str, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let limit_str = limit.to_string();
    let output = run_git_command(
        &["log", "--format=%H|%h|%s|%an|%at", "-n", &limit_str],
        repo_path,
    )?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let commits: Vec<CommitInfo> = output_str
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(5, '|').collect();
            if parts.len() >= 5 {
                Some(CommitInfo {
                    hash: parts[0].to_string(),
                    short_hash: parts[1].to_string(),
                    message: parts[2].to_string(),
                    author: parts[3].to_string(),
                    date: parts[4].parse().unwrap_or(0),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(commits)
}

/// List all worktrees for a repository.
pub fn list_worktrees(repo_path: &str) -> Result<Vec<WorktreeInfo>, String> {
    let output = run_git_command(&["worktree", "list", "--porcelain"], repo_path)?;

    let mut worktrees: Vec<WorktreeInfo> = Vec::new();
    let output_str = String::from_utf8_lossy(&output.stdout);

    let main_path = Path::new(repo_path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let mut current_path: Option<String> = None;
    let mut current_commit: Option<String> = None;
    let mut worktree_branch: Option<String> = None;
    let mut is_locked = false;
    let mut lock_reason: Option<String> = None;
    let mut is_bare = false;

    for line in output_str.lines() {
        if line.is_empty() {
            if let Some(worktree_path) = current_path.take() {
                let worktree_path_obj = Path::new(&worktree_path);

                // Skip worktrees that no longer exist on disk (stale/prunable)
                if !worktree_path_obj.exists() {
                    // Clear state for this worktree entry
                    current_commit.take();
                    worktree_branch.take();
                    lock_reason.take();
                    is_locked = false;
                    is_bare = false;
                    continue;
                }

                let path = worktree_path_obj
                    .canonicalize()
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .to_string();

                let is_main = path == main_path;

                let name = if is_main {
                    "main".to_string()
                } else {
                    Path::new(&worktree_path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "worktree".to_string())
                };

                let branch = worktree_branch
                    .take()
                    .map(|b| b.strip_prefix("refs/heads/").unwrap_or(&b).to_string());

                if !is_bare {
                    worktrees.push(WorktreeInfo {
                        id: Uuid::new_v4().to_string(),
                        name,
                        path,
                        branch,
                        commit: current_commit.take(),
                        is_main,
                        is_locked,
                        lock_reason: lock_reason.take(),
                        startup_script: None,
                        script_executed: false,
                        created_at: 0,
                    });
                }
            }

            is_locked = false;
            is_bare = false;
            continue;
        }

        if let Some(path) = line.strip_prefix("worktree ") {
            current_path = Some(path.to_string());
        } else if let Some(commit) = line.strip_prefix("HEAD ") {
            current_commit = Some(commit.to_string());
        } else if let Some(branch) = line.strip_prefix("branch ") {
            worktree_branch = Some(branch.to_string());
        } else if line == "locked" {
            is_locked = true;
        } else if let Some(reason) = line.strip_prefix("locked ") {
            is_locked = true;
            lock_reason = Some(reason.to_string());
        } else if line == "bare" {
            is_bare = true;
        }
    }

    // Handle the last worktree if output doesn't end with blank line
    if let Some(worktree_path) = current_path.take() {
        let worktree_path_obj = Path::new(&worktree_path);

        // Skip worktrees that no longer exist on disk (stale/prunable)
        if worktree_path_obj.exists() {
            let path = worktree_path_obj
                .canonicalize()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();

            let is_main = path == main_path;

            let name = if is_main {
                "main".to_string()
            } else {
                Path::new(&worktree_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "worktree".to_string())
            };

            let branch = worktree_branch
                .take()
                .map(|b| b.strip_prefix("refs/heads/").unwrap_or(&b).to_string());

            if !is_bare {
                worktrees.push(WorktreeInfo {
                    id: Uuid::new_v4().to_string(),
                    name,
                    path,
                    branch,
                    commit: current_commit.take(),
                    is_main,
                    is_locked,
                    lock_reason: lock_reason.take(),
                    startup_script: None,
                    script_executed: false,
                    created_at: 0,
                });
            }
        }
    }

    Ok(worktrees)
}

/// Create a new worktree.
pub fn create_worktree(
    repo_path: &str,
    name: &str,
    branch: Option<&str>,
    commit: Option<&str>,
    startup_script: Option<&str>,
    execute_script: bool,
) -> Result<WorktreeInfo, String> {
    let repo_path_canonical = Path::new(repo_path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let repo_path_str = repo_path_canonical.to_string_lossy().to_string();

    // Use ~/.aristar-worktrees/{hash}/{name} for worktree location
    ensure_repo_info(&repo_path_str)?;
    let worktree_base = get_worktree_base_for_repo(&repo_path_str);
    let worktree_path = worktree_base.join(name);
    let worktree_path_str = worktree_path.to_string_lossy().to_string();

    let mut args = vec!["worktree", "add", worktree_path_str.as_str()];

    if let Some(b) = branch {
        args.push(b);
    } else if let Some(c) = commit {
        args.push(c);
    }

    run_git_command(&args, &repo_path_str)?;

    let worktrees = list_worktrees(&repo_path_str)?;
    let new_worktree = worktrees
        .iter()
        .find(|w| w.path == worktree_path_str)
        .cloned()
        .ok_or("Failed to find created worktree")?;

    if let Some(script) = startup_script {
        let script_path = worktree_path.join(".worktree-setup.sh");
        std::fs::write(&script_path, script).map_err(|e| e.to_string())?;

        if execute_script {
            let output = Command::new("bash")
                .arg(&script_path)
                .current_dir(&worktree_path)
                .output()
                .map_err(|e| e.to_string())?;

            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }
        }
    }

    Ok(new_worktree)
}

/// Remove a worktree.
pub fn remove_worktree(path: &str, force: bool, delete_branch: bool) -> Result<(), String> {
    let repo_path = find_git_repo_root(path)?;
    let path_canonical = Path::new(path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    // Get branch name before deletion (if we need to delete it)
    let branch_to_delete = if delete_branch {
        let worktrees = list_worktrees(&repo_path)?;
        worktrees
            .iter()
            .find(|w| w.path == path_canonical)
            .and_then(|w| w.branch.clone())
    } else {
        None
    };

    // Remove worktree first
    let mut args = vec!["worktree", "remove", &path_canonical];
    if force {
        // Git requires --force twice to remove a locked worktree
        args.push("--force");
        args.push("--force");
    }

    run_git_command(&args, &repo_path)?;

    // Then delete branch if requested (skip protected branches)
    if let Some(branch) = branch_to_delete {
        let protected = ["main", "master", "develop", "development"];
        if !protected.contains(&branch.as_str()) {
            let delete_args = if force {
                vec!["branch", "-D", &branch]
            } else {
                vec!["branch", "-d", &branch]
            };
            // Ignore errors - branch might already be deleted or have unmerged changes
            let _ = run_git_command(&delete_args, &repo_path);
        }
    }

    Ok(())
}

/// Rename a worktree.
pub fn rename_worktree(old_path: &str, new_name: &str) -> Result<WorktreeInfo, String> {
    let repo_path = find_git_repo_root(old_path)?;
    let old_path_canonical = Path::new(old_path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let parent = Path::new(&old_path_canonical)
        .parent()
        .ok_or("No parent directory")?;
    let new_path = parent.join(new_name);
    let new_path_string = new_path.to_string_lossy().to_string();

    let mut args = vec!["worktree", "move", &old_path_canonical];
    args.push(&new_path_string);

    run_git_command(&args, &repo_path)?;

    let worktrees = list_worktrees(&repo_path)?;
    worktrees
        .iter()
        .find(|w| w.path == new_path_string)
        .cloned()
        .ok_or_else(|| "Failed to find renamed worktree".to_string())
}

/// Lock a worktree.
pub fn lock_worktree(path: &str, reason: Option<&str>) -> Result<(), String> {
    let repo_path = find_git_repo_root(path)?;
    let path_canonical = Path::new(path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let mut args = vec!["worktree", "lock", &path_canonical];
    if let Some(r) = reason {
        args.push("--reason");
        args.push(r);
    }

    run_git_command(&args, &repo_path)?;

    Ok(())
}

/// Unlock a worktree.
pub fn unlock_worktree(path: &str) -> Result<(), String> {
    let repo_path = find_git_repo_root(path)?;
    let path_canonical = Path::new(path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    run_git_command(&["worktree", "unlock", &path_canonical], &repo_path)?;

    Ok(())
}

/// Find the root git repository for a path (works for worktrees too).
pub fn find_git_repo_root(path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("No git repository found".to_string());
    }

    let git_dir = String::from_utf8_lossy(&output.stdout).trim().to_string();

    let git_path = if git_dir == ".git" {
        Path::new(path).canonicalize().map_err(|e| e.to_string())?
    } else {
        let git_path = Path::new(&git_dir);
        if git_path.is_absolute() {
            if git_dir.contains("/worktrees/") {
                let parts: Vec<&str> = git_dir.split("/.git/worktrees/").collect();
                if !parts.is_empty() {
                    Path::new(parts[0]).to_path_buf()
                } else {
                    git_path.parent().unwrap_or(git_path).to_path_buf()
                }
            } else {
                git_path.parent().unwrap_or(git_path).to_path_buf()
            }
        } else {
            Path::new(path)
                .join(&git_dir)
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| Path::new(path).to_path_buf())
        }
    };

    Ok(git_path.to_string_lossy().to_string())
}

/// Create a worktree at a specific custom path.
/// Used by the Agent Manager to create worktrees inside task folders.
///
/// # Security
/// This function validates that the destination path is within allowed directories
/// to prevent path traversal attacks.
pub fn create_worktree_at_path(
    repo_path: &str,
    destination_path: &str,
    branch_or_commit: Option<&str>,
) -> Result<String, String> {
    let repo_path_canonical = Path::new(repo_path)
        .canonicalize()
        .map_err(|e| format!("Failed to resolve repo path: {}", e))?;
    let repo_path_str = repo_path_canonical.to_string_lossy().to_string();

    // Security: Validate destination path is within allowed directories
    let dest_path = Path::new(destination_path);
    let allowed_bases = get_allowed_worktree_bases();
    validate_path_within_bases(dest_path, &allowed_bases)?;

    // Ensure the parent directory exists
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    // Build the git worktree add command
    let mut args = vec!["worktree", "add", destination_path];

    // Always use --detach to create worktrees in detached HEAD mode.
    // This prevents "branch already used by worktree" errors when creating
    // multiple worktrees from the same branch (e.g., for agent tasks).
    args.push("--detach");

    if let Some(ref_name) = branch_or_commit {
        args.push(ref_name);
    }

    run_git_command(&args, &repo_path_str)?;

    // Canonicalize the destination path after creation
    let created_path = Path::new(destination_path)
        .canonicalize()
        .map_err(|e| format!("Failed to resolve created worktree path: {}", e))?
        .to_string_lossy()
        .to_string();

    Ok(created_path)
}

// ============ Async Versions ============
// These versions use spawn_blocking to avoid blocking the Tauri main thread.

/// List all worktrees for a repository (async version).
/// Use this from Tauri commands to avoid freezing the UI.
pub async fn list_worktrees_async(repo_path: String) -> Result<Vec<WorktreeInfo>, String> {
    tokio::task::spawn_blocking(move || list_worktrees(&repo_path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Create a new worktree (async version).
/// Use this from Tauri commands to avoid freezing the UI.
pub async fn create_worktree_async(
    repo_path: String,
    name: String,
    branch: Option<String>,
    commit: Option<String>,
    startup_script: Option<String>,
    execute_script: bool,
) -> Result<WorktreeInfo, String> {
    tokio::task::spawn_blocking(move || {
        create_worktree(
            &repo_path,
            &name,
            branch.as_deref(),
            commit.as_deref(),
            startup_script.as_deref(),
            execute_script,
        )
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Remove a worktree (async version).
/// Use this from Tauri commands to avoid freezing the UI.
pub async fn remove_worktree_async(
    path: String,
    force: bool,
    delete_branch: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || remove_worktree(&path, force, delete_branch))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Rename a worktree (async version).
/// Use this from Tauri commands to avoid freezing the UI.
pub async fn rename_worktree_async(old_path: String, new_name: String) -> Result<WorktreeInfo, String> {
    tokio::task::spawn_blocking(move || rename_worktree(&old_path, &new_name))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Get branches (async version).
/// Use this from Tauri commands to avoid freezing the UI.
pub async fn get_branches_async(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    tokio::task::spawn_blocking(move || get_branches(&repo_path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Get commits (async version).
/// Use this from Tauri commands to avoid freezing the UI.
pub async fn get_commits_async(repo_path: String, limit: usize) -> Result<Vec<CommitInfo>, String> {
    tokio::task::spawn_blocking(move || get_commits(&repo_path, limit))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Create worktree at a specific path (async version).
/// Use this from Tauri commands to avoid freezing the UI.
#[allow(dead_code)]
pub async fn create_worktree_at_path_async(
    repo_path: String,
    destination_path: String,
    branch_or_commit: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        create_worktree_at_path(&repo_path, &destination_path, branch_or_commit.as_deref())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
