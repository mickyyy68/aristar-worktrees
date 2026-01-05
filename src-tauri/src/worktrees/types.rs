//! Worktree-related types.

use serde::{Deserialize, Serialize};

use crate::core::AppSettings;

/// Information about a single worktree.
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

/// Repository with its worktrees.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: String,
    pub path: String,
    pub name: String,
    pub worktrees: Vec<WorktreeInfo>,
    pub last_scanned: i64,
}

/// Branch information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

/// Commit information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: i64,
}

/// Persistent store data for worktrees/repositories.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoreData {
    pub repositories: Vec<Repository>,
    pub settings: AppSettings,
}
