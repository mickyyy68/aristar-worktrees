//! Tauri commands for agent manager operations.

use std::path::PathBuf;
use tauri::State;

use super::agent_operations;
use super::opencode::OpenCodeManager;
use super::store::TaskManagerState;
use super::task_operations;
use super::types::{AgentStatus, ModelSelection, Task, TaskStatus};

// ============ Task Commands ============

#[tauri::command]
#[allow(clippy::too_many_arguments)]
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
    task_operations::create_task_impl(
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
    task_operations::get_tasks_impl(&state)
}

#[tauri::command]
pub fn get_task(state: State<TaskManagerState>, task_id: String) -> Result<Task, String> {
    task_operations::get_task_impl(&state, &task_id)
}

#[tauri::command]
pub fn update_task(
    state: State<TaskManagerState>,
    task_id: String,
    name: Option<String>,
    status: Option<TaskStatus>,
) -> Result<Task, String> {
    task_operations::update_task_impl(&state, task_id, name, status)
}

#[tauri::command]
pub fn delete_task(
    state: State<TaskManagerState>,
    task_id: String,
    delete_worktrees: bool,
) -> Result<(), String> {
    task_operations::delete_task_impl(&state, task_id, delete_worktrees)
}

// ============ Agent Commands ============

#[tauri::command]
pub fn add_agent_to_task(
    state: State<TaskManagerState>,
    task_id: String,
    model_id: String,
    provider_id: String,
    agent_type: Option<String>,
) -> Result<Task, String> {
    agent_operations::add_agent_to_task_impl(&state, task_id, model_id, provider_id, agent_type)
}

#[tauri::command]
pub fn remove_agent_from_task(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
    delete_worktree: bool,
) -> Result<(), String> {
    agent_operations::remove_agent_from_task_impl(&state, task_id, agent_id, delete_worktree)
}

#[tauri::command]
pub fn update_agent_session(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
    session_id: Option<String>,
) -> Result<(), String> {
    agent_operations::update_agent_session_impl(&state, task_id, agent_id, session_id)
}

#[tauri::command]
pub fn update_agent_status(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
    status: AgentStatus,
) -> Result<(), String> {
    agent_operations::update_agent_status_impl(&state, task_id, agent_id, status)
}

#[tauri::command]
pub fn accept_agent(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
) -> Result<(), String> {
    agent_operations::accept_agent_impl(&state, task_id, agent_id)
}

#[tauri::command]
pub fn cleanup_unaccepted_agents(
    state: State<TaskManagerState>,
    task_id: String,
) -> Result<(), String> {
    agent_operations::cleanup_unaccepted_agents_impl(&state, task_id)
}

// ============ Worktree Validation Commands ============

#[tauri::command]
pub fn validate_task_worktrees(
    state: State<TaskManagerState>,
    task_id: String,
) -> Result<Vec<String>, String> {
    agent_operations::validate_task_worktrees_impl(&state, task_id)
}

#[tauri::command]
pub fn recreate_agent_worktree(
    state: State<TaskManagerState>,
    task_id: String,
    agent_id: String,
) -> Result<String, String> {
    agent_operations::recreate_agent_worktree_impl(&state, task_id, agent_id)
}

// ============ Agent OpenCode Commands ============

/// Start OpenCode server for a specific agent.
#[tauri::command]
pub fn start_agent_opencode(
    task_state: State<TaskManagerState>,
    opencode_state: State<OpenCodeManager>,
    task_id: String,
    agent_id: String,
) -> Result<u16, String> {
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

/// Stop OpenCode server for a specific agent.
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

/// Get OpenCode port for a specific agent.
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

/// Stop all OpenCode servers for all agents in a task.
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

// ============ Worktree-level OpenCode Commands ============
// These are for the worktree panel, not agent manager

/// Start OpenCode for a worktree (not agent).
#[tauri::command]
pub fn start_opencode(state: State<OpenCodeManager>, worktree_path: String) -> Result<u16, String> {
    let path = PathBuf::from(worktree_path);
    state.start(path)
}

/// Stop OpenCode for a worktree (not agent).
#[tauri::command]
pub fn stop_opencode(state: State<OpenCodeManager>, worktree_path: String) -> Result<(), String> {
    let path = PathBuf::from(worktree_path);
    state.stop(&path)
}

/// Get OpenCode status for a worktree.
#[tauri::command]
pub fn get_opencode_status(
    state: State<OpenCodeManager>,
    worktree_path: String,
) -> Result<Option<u16>, String> {
    let path = PathBuf::from(worktree_path);
    state.get_port(&path)
}

/// Check if OpenCode is running for a worktree.
#[tauri::command]
pub fn is_opencode_running(state: State<OpenCodeManager>, worktree_path: String) -> bool {
    let path = PathBuf::from(worktree_path);
    state.is_running(&path)
}
