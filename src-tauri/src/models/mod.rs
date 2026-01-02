use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub theme: String,
    pub auto_refresh: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeMetadata {
    pub id: String,
    pub repository_id: String,
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
    pub worktrees: Vec<WorktreeMetadata>,
    pub last_scanned: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoreData {
    pub repositories: Vec<Repository>,
    pub settings: AppSettings,
}
