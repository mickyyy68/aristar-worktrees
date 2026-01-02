#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub branch: Option<String>,
    pub commit: Option<String>,
    pub is_main: bool,
    pub is_locked: bool,
    pub lock_reason: Option<String>,
    pub startup_script: Option<String>,
    pub script_executed: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: String,
    pub path: String,
    pub name: String,
    pub worktrees: Vec<WorktreeInfo>,
    pub last_scanned: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub theme: String,
    pub auto_refresh: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoreData {
    pub repositories: Vec<Repository>,
    pub settings: AppSettings,
}

pub fn get_repository_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

/// Get the base directory for all aristar worktrees (~/.aristar-worktrees)
fn get_aristar_worktrees_base() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
}

/// Generate a hash for the repository path (first 8 hex chars of SHA256)
fn get_repo_hash(repo_path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(repo_path.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..4]) // First 4 bytes = 8 hex chars
}

/// Get the worktree base directory for a specific repository
fn get_worktree_base_for_repo(repo_path: &str) -> PathBuf {
    get_aristar_worktrees_base().join(get_repo_hash(repo_path))
}

/// Ensure the repo info file exists in the worktree base directory
fn ensure_repo_info(repo_path: &str) -> Result<(), String> {
    let base = get_worktree_base_for_repo(repo_path);
    std::fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    let info_file = base.join(".aristar-repo-info.json");
    if !info_file.exists() {
        let info = serde_json::json!({"originalPath": repo_path});
        std::fs::write(&info_file, info.to_string()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn is_git_repository(path: &str) -> bool {
    let git_path = format!("{}/.git", path);
    Path::new(&git_path).exists() || Path::new(path).join(".git").is_dir()
}

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

pub fn get_current_branch(repo_path: &str) -> Result<String, String> {
    let output = run_git_command(&["symbolic-ref", "--short", "HEAD"], repo_path)?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

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

pub fn list_worktrees(repo_path: &str) -> Result<Vec<WorktreeInfo>, String> {
    let output = run_git_command(&["worktree", "list", "--porcelain"], repo_path)?;

    let mut worktrees: Vec<WorktreeInfo> = Vec::new();
    let output_str = String::from_utf8_lossy(&output.stdout);

    let main_path = Path::new(repo_path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    // Git worktree --porcelain output format:
    // worktree /path/to/worktree
    // HEAD <commit-sha>
    // branch refs/heads/branch-name
    // <blank line>
    //
    // Each worktree block is separated by blank lines

    let mut current_path: Option<String> = None;
    let mut current_commit: Option<String> = None;
    let mut worktree_branch: Option<String> = None;
    let mut is_locked = false;
    let mut lock_reason: Option<String> = None;
    let mut is_bare = false;

    for line in output_str.lines() {
        if line.is_empty() {
            // End of a worktree block - save it if we have a path
            if let Some(worktree_path) = current_path.take() {
                let path = Path::new(&worktree_path)
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

                // Extract branch name from refs/heads/branch-name format
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

            // Reset for next worktree
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
        // Note: "detached" is also a valid state but we don't need to track it
    }

    // Handle the last worktree if output doesn't end with blank line
    if let Some(worktree_path) = current_path.take() {
        let path = Path::new(&worktree_path)
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

    Ok(worktrees)
}

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

fn find_git_repo_root(path: &str) -> Result<String, String> {
    // Use git rev-parse to find the actual git directory
    // This works for both regular repos and worktrees
    let output = Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("No git repository found".to_string());
    }

    let git_dir = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // For worktrees, git-dir will be something like /path/to/main/.git/worktrees/name
    // For main repos, it will be .git or /absolute/path/.git
    // We need to find the main repository's working directory

    let git_path = if git_dir == ".git" {
        Path::new(path).canonicalize().map_err(|e| e.to_string())?
    } else {
        let git_path = Path::new(&git_dir);
        if git_path.is_absolute() {
            // Check if this is a worktree's git dir (contains "worktrees" in path)
            if git_dir.contains("/worktrees/") {
                // Extract main repo path: /path/to/main/.git/worktrees/name -> /path/to/main
                let parts: Vec<&str> = git_dir.split("/.git/worktrees/").collect();
                if parts.len() >= 1 {
                    Path::new(parts[0]).to_path_buf()
                } else {
                    git_path.parent().unwrap_or(git_path).to_path_buf()
                }
            } else {
                // Regular absolute .git path
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

pub fn open_in_terminal(path: &str) -> Result<(), String> {
    let escaped_path = path.replace('"', "\\\"");
    let script = format!(
        "tell application \"Terminal\" to do script \"cd \\\"{}\\\" && clear\"",
        escaped_path
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

pub fn open_in_editor(path: &str) -> Result<(), String> {
    let editors = vec!["code", "idea", "nvim", "vim", "emacs"];

    for editor in editors {
        if Command::new(editor)
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .is_ok()
        {
            Command::new(editor)
                .arg(path)
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn reveal_in_finder(path: &str) -> Result<(), String> {
    let output = Command::new("open")
        .args(&["-R", path])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

pub fn copy_to_clipboard(text: &str) -> Result<(), String> {
    let mut child = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    stdin
        .write_all(text.as_bytes())
        .map_err(|e| e.to_string())?;
    drop(stdin);

    child.wait().map_err(|e| e.to_string())?;

    Ok(())
}
