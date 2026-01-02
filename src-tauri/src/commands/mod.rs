#![allow(dead_code)]

use chrono::Utc;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

pub mod opencode_manager;
pub mod task_manager;
pub mod worktree;

#[cfg(test)]
mod tests;

pub use opencode_manager::OpenCodeManager;
pub use task_manager::TaskManagerState;
use worktree::{CommitInfo, Repository, StoreData, WorktreeInfo};

use crate::models::task::{AgentStatus, ModelSelection, Task, TaskStatus};

fn get_store_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
        .join("store.json")
}

fn load_store_data() -> StoreData {
    let store_path = get_store_path();

    if !store_path.exists() {
        println!("[persistence] No store file found, using defaults");
        return StoreData::default();
    }

    match std::fs::read_to_string(&store_path) {
        Ok(contents) => match serde_json::from_str::<StoreData>(&contents) {
            Ok(data) => {
                println!(
                    "[persistence] Loaded {} repositories from store",
                    data.repositories.len()
                );
                data
            }
            Err(e) => {
                eprintln!("[persistence] Failed to parse store file: {}", e);
                StoreData::default()
            }
        },
        Err(e) => {
            eprintln!("[persistence] Failed to read store file: {}", e);
            StoreData::default()
        }
    }
}

fn save_store_data(data: &StoreData) -> Result<(), String> {
    let store_path = get_store_path();

    if let Some(parent) = store_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create store directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize store data: {}", e))?;

    std::fs::write(&store_path, json).map_err(|e| format!("Failed to write store file: {}", e))?;

    println!(
        "[persistence] Saved {} repositories to store",
        data.repositories.len()
    );
    Ok(())
}

pub struct AppState {
    pub store: Mutex<StoreData>,
}

impl AppState {
    fn save(&self) -> Result<(), String> {
        let store = self.store.lock().map_err(|e| e.to_string())?;
        save_store_data(&store)
    }
}

#[tauri::command]
pub fn get_repositories(state: State<AppState>) -> Result<Vec<Repository>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.repositories.clone())
}

#[tauri::command]
pub fn add_repository(state: State<AppState>, path: String) -> Result<Repository, String> {
    println!("[add_repository] Called with path: {}", path);
    let abs_path = Path::new(&path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    if !worktree::is_git_repository(&abs_path) {
        return Err("Not a valid git repository".to_string());
    }

    let worktrees = worktree::list_worktrees(&abs_path)?;

    let repo = Repository {
        id: uuid::Uuid::new_v4().to_string(),
        path: abs_path.clone(),
        name: worktree::get_repository_name(&abs_path),
        worktrees,
        last_scanned: Utc::now().timestamp_millis(),
    };

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if store.repositories.iter().any(|r| r.path == repo.path) {
            return Err("Repository already added".to_string());
        }
        store.repositories.push(repo.clone());
    }

    state.save()?;
    Ok(repo)
}

#[tauri::command]
pub fn remove_repository(state: State<AppState>, id: String) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.repositories.retain(|r| r.id != id);
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn refresh_repository(state: State<AppState>, id: String) -> Result<Repository, String> {
    let repo = {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if let Some(repo) = store.repositories.iter_mut().find(|r| r.id == id) {
            let worktrees = worktree::list_worktrees(&repo.path)?;
            repo.worktrees = worktrees;
            repo.last_scanned = Utc::now().timestamp_millis();
            repo.clone()
        } else {
            return Err("Repository not found".to_string());
        }
    };

    state.save()?;
    Ok(repo)
}

#[tauri::command]
pub fn list_worktrees(repo_path: String) -> Result<Vec<WorktreeInfo>, String> {
    worktree::list_worktrees(&repo_path)
}

#[tauri::command]
pub fn create_worktree(
    state: State<AppState>,
    repo_path: String,
    name: String,
    branch: Option<String>,
    commit: Option<String>,
    startup_script: Option<String>,
    execute_script: bool,
) -> Result<WorktreeInfo, String> {
    let new_worktree = worktree::create_worktree(
        &repo_path,
        &name,
        branch.as_deref(),
        commit.as_deref(),
        startup_script.as_deref(),
        execute_script,
    )?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if let Some(repo) = store.repositories.iter_mut().find(|r| r.path == repo_path) {
            if !repo.worktrees.iter().any(|w| w.path == new_worktree.path) {
                repo.worktrees.push(new_worktree.clone());
            }
        }
    }

    state.save()?;
    Ok(new_worktree)
}

#[tauri::command]
pub fn remove_worktree(
    state: State<AppState>,
    path: String,
    force: bool,
    delete_branch: bool,
) -> Result<(), String> {
    worktree::remove_worktree(&path, force, delete_branch)?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            repo.worktrees.retain(|w| w.path != path);
        }
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn rename_worktree(
    state: State<AppState>,
    old_path: String,
    new_name: String,
) -> Result<WorktreeInfo, String> {
    let renamed_worktree = worktree::rename_worktree(&old_path, &new_name)?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            if let Some(idx) = repo.worktrees.iter().position(|w| w.path == old_path) {
                repo.worktrees[idx] = renamed_worktree.clone();
                break;
            }
        }
    }

    state.save()?;
    Ok(renamed_worktree)
}

#[tauri::command]
pub fn lock_worktree(
    state: State<AppState>,
    path: String,
    reason: Option<String>,
) -> Result<(), String> {
    worktree::lock_worktree(&path, reason.as_deref())?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            if let Some(wt) = repo.worktrees.iter_mut().find(|w| w.path == path) {
                wt.is_locked = true;
                wt.lock_reason = reason.clone();
                break;
            }
        }
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn unlock_worktree(state: State<AppState>, path: String) -> Result<(), String> {
    worktree::unlock_worktree(&path)?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            if let Some(wt) = repo.worktrees.iter_mut().find(|w| w.path == path) {
                wt.is_locked = false;
                wt.lock_reason = None;
                break;
            }
        }
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn get_branches(repo_path: String) -> Result<Vec<worktree::BranchInfo>, String> {
    worktree::get_branches(&repo_path)
}

#[tauri::command]
pub fn get_commits(repo_path: String, limit: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    worktree::get_commits(&repo_path, limit.unwrap_or(50))
}

#[tauri::command]
pub fn open_in_terminal(
    path: String,
    app: String,
    custom_command: Option<String>,
) -> Result<(), String> {
    worktree::open_in_terminal(&path, &app, custom_command.as_deref())
}

#[tauri::command]
pub fn open_in_editor(
    path: String,
    app: String,
    custom_command: Option<String>,
) -> Result<(), String> {
    worktree::open_in_editor(&path, &app, custom_command.as_deref())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    worktree::reveal_in_finder(&path)
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    worktree::copy_to_clipboard(&text)
}

#[tauri::command]
pub fn start_opencode(state: State<OpenCodeManager>, worktree_path: String) -> Result<u16, String> {
    let path = PathBuf::from(worktree_path);
    state.start(path)
}

#[tauri::command]
pub fn stop_opencode(state: State<OpenCodeManager>, worktree_path: String) -> Result<(), String> {
    let path = PathBuf::from(worktree_path);
    state.stop(&path)
}

#[tauri::command]
pub fn get_opencode_status(
    state: State<OpenCodeManager>,
    worktree_path: String,
) -> Result<Option<u16>, String> {
    let path = PathBuf::from(worktree_path);
    state.get_port(&path)
}

#[tauri::command]
pub fn is_opencode_running(state: State<OpenCodeManager>, worktree_path: String) -> bool {
    let path = PathBuf::from(worktree_path);
    state.is_running(&path)
}

pub fn init_store() -> AppState {
    println!("[persistence] Initializing store...");
    let data = load_store_data();
    AppState {
        store: Mutex::new(data),
    }
}

// ============ Task Manager Commands ============

#[tauri::command]
pub fn create_task(
    state: State<TaskManagerState>,
    name: String,
    source_type: String,
    source_branch: Option<String>,
    source_commit: Option<String>,
    source_repo_path: String,
    agent_type: String,
    models: Vec<ModelSelection>,
) -> Result<Task, String> {
    task_manager::create_task_impl(
        &state,
        name,
        source_type,
        source_branch,
        source_commit,
        source_repo_path,
        agent_type,
        models,
    )
}

#[tauri::command]
pub fn get_tasks(state: State<TaskManagerState>) -> Result<Vec<Task>, String> {
    task_manager::get_tasks_impl(&state)
}

#[tauri::command]
pub fn get_task(state: State<TaskManagerState>, task_id: String) -> Result<Task, String> {
    task_manager::get_task_impl(&state, &task_id)
}

#[tauri::command]
pub fn update_task(
    state: State<TaskManagerState>,
    task_id: String,
    name: Option<String>,
    status: Option<TaskStatus>,
) -> Result<Task, String> {
    task_manager::update_task_impl(&state, task_id, name, status)
}

#[tauri::command]
pub fn delete_task(
    state: State<TaskManagerState>,
    task_id: String,
    delete_worktrees: bool,
) -> Result<(), String> {
    task_manager::delete_task_impl(&state, task_id, delete_worktrees)
}

#[tauri::command]
pub fn add_agent_to_task(
    state: State<TaskManagerState>,
    task_id: String,
    model_id: String,
    provider_id: String,
    agent_type: Option<String>,
) -> Result<Task, String> {
    task_manager::add_agent_to_task_impl(&state, task_id, model_id, provider_id, agent_type)
}

#[tauri::command]
pub fn remove_agent_from_task(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
    delete_worktree: bool,
) -> Result<(), String> {
    task_manager::remove_agent_from_task_impl(&state, task_id, agent_id, delete_worktree)
}

#[tauri::command]
pub fn update_agent_session(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
    session_id: Option<String>,
) -> Result<(), String> {
    task_manager::update_agent_session_impl(&state, task_id, agent_id, session_id)
}

#[tauri::command]
pub fn update_agent_status(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
    status: AgentStatus,
) -> Result<(), String> {
    task_manager::update_agent_status_impl(&state, task_id, agent_id, status)
}

#[tauri::command]
pub fn accept_agent(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
) -> Result<(), String> {
    task_manager::accept_agent_impl(&state, task_id, agent_id)
}

#[tauri::command]
pub fn cleanup_unaccepted_agents(
    state: State<TaskManagerState>,
    task_id: String,
) -> Result<(), String> {
    task_manager::cleanup_unaccepted_agents_impl(&state, task_id)
}

// ============ Agent OpenCode Commands ============

/// Start OpenCode server for a specific agent (uses agent's worktree as working directory)
#[tauri::command]
pub fn start_agent_opencode(
    task_state: State<TaskManagerState>,
    opencode_state: State<OpenCodeManager>,
    task_id: String,
    agent_id: String,
) -> Result<u16, String> {
    // Get the agent's worktree path from the task
    let worktree_path = {
        let store = task_state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent = task
            .agents
            .iter()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        agent.worktree_path.clone()
    };

    let path = PathBuf::from(worktree_path);
    opencode_state.start(path)
}

/// Stop OpenCode server for a specific agent
#[tauri::command]
pub fn stop_agent_opencode(
    task_state: State<TaskManagerState>,
    opencode_state: State<OpenCodeManager>,
    task_id: String,
    agent_id: String,
) -> Result<(), String> {
    let worktree_path = {
        let store = task_state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent = task
            .agents
            .iter()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        agent.worktree_path.clone()
    };

    let path = PathBuf::from(worktree_path);
    opencode_state.stop(&path)
}

/// Get OpenCode port for a specific agent
#[tauri::command]
pub fn get_agent_opencode_port(
    task_state: State<TaskManagerState>,
    opencode_state: State<OpenCodeManager>,
    task_id: String,
    agent_id: String,
) -> Result<Option<u16>, String> {
    let worktree_path = {
        let store = task_state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent = task
            .agents
            .iter()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        agent.worktree_path.clone()
    };

    let path = PathBuf::from(worktree_path);
    opencode_state.get_port(&path)
}

/// Stop all OpenCode servers for all agents in a task
#[tauri::command]
pub fn stop_task_all_opencode(
    task_state: State<TaskManagerState>,
    opencode_state: State<OpenCodeManager>,
    task_id: String,
) -> Result<(), String> {
    let worktree_paths: Vec<String> = {
        let store = task_state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        task.agents
            .iter()
            .map(|a| a.worktree_path.clone())
            .collect()
    };

    for worktree_path in worktree_paths {
        let path = PathBuf::from(worktree_path);
        let _ = opencode_state.stop(&path);
    }

    Ok(())
}

// ============ Worktree Validation Commands ============

/// Validate worktrees for a task - returns list of agent IDs with missing worktrees
#[tauri::command]
pub fn validate_task_worktrees(
    state: State<TaskManagerState>,
    task_id: String,
) -> Result<Vec<String>, String> {
    task_manager::validate_task_worktrees_impl(&state, task_id)
}

/// Recreate a worktree for an orphaned agent
#[tauri::command]
pub fn recreate_agent_worktree(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
) -> Result<String, String> {
    task_manager::recreate_agent_worktree_impl(&state, task_id, agent_id)
}
