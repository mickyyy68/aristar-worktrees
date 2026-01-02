//! Task Manager for the Agent Manager feature.
//!
//! Handles CRUD operations for tasks and agents, including:
//! - Task creation with multiple agents
//! - Worktree management for agents
//! - Task persistence to ~/.aristar-worktrees/tasks.json

use crate::commands::worktree;
use crate::models::task::{
    AgentStatus, ModelSelection, Task, TaskAgent, TaskStatus, TaskStoreData,
};
use chrono::Utc;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::Mutex;

// ============ Path Utilities ============

/// Get the base path for task storage: ~/.aristar-worktrees/tasks/
pub fn get_tasks_base_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
        .join("tasks")
}

/// Get the path to tasks.json: ~/.aristar-worktrees/tasks.json
fn get_tasks_store_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
        .join("tasks.json")
}

/// Get the folder path for a specific task: ~/.aristar-worktrees/tasks/{task-id}/
pub fn get_task_folder_path(task_id: &str) -> PathBuf {
    get_tasks_base_path().join(task_id)
}

// ============ ID and Name Utilities ============

/// Generate an 8-character task ID from the task name and current time
fn generate_task_id(name: &str) -> String {
    let mut hasher = DefaultHasher::new();
    name.hash(&mut hasher);
    Utc::now().timestamp_millis().hash(&mut hasher);
    format!("{:08x}", hasher.finish() & 0xFFFFFFFF)
}

/// Slugify a string for use in folder names
/// e.g., "Refactor Authentication" -> "refactor-authentication"
fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Slugify model ID for use in folder names
/// e.g., "claude-sonnet-4" stays as "claude-sonnet-4"
fn slugify_model_id(model_id: &str) -> String {
    model_id
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

// ============ Persistence ============

/// Load tasks from tasks.json
fn load_tasks() -> TaskStoreData {
    let store_path = get_tasks_store_path();

    if !store_path.exists() {
        println!("[task_manager] No tasks file found, using defaults");
        return TaskStoreData::default();
    }

    match std::fs::read_to_string(&store_path) {
        Ok(contents) => match serde_json::from_str(&contents) {
            Ok(data) => {
                println!("[task_manager] Loaded tasks from store");
                data
            }
            Err(e) => {
                eprintln!("[task_manager] Failed to parse tasks file: {}", e);
                TaskStoreData::default()
            }
        },
        Err(e) => {
            eprintln!("[task_manager] Failed to read tasks file: {}", e);
            TaskStoreData::default()
        }
    }
}

/// Save tasks to tasks.json
fn save_tasks(data: &TaskStoreData) -> Result<(), String> {
    let store_path = get_tasks_store_path();

    if let Some(parent) = store_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create tasks directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize tasks: {}", e))?;

    std::fs::write(&store_path, json).map_err(|e| format!("Failed to write tasks file: {}", e))?;

    println!("[task_manager] Saved {} tasks to store", data.tasks.len());
    Ok(())
}

// ============ Task Manager State ============

/// Task Manager state - holds in-memory task data
#[derive(Default)]
pub struct TaskManagerState {
    pub store: Mutex<TaskStoreData>,
}

impl TaskManagerState {
    pub fn new() -> Self {
        Self {
            store: Mutex::new(load_tasks()),
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let store = self.store.lock().map_err(|e| e.to_string())?;
        save_tasks(&store)
    }
}

// ============ Task CRUD Operations ============

/// Create a new task with agents
pub fn create_task_impl(
    state: &TaskManagerState,
    name: String,
    source_type: String,
    source_branch: Option<String>,
    source_commit: Option<String>,
    source_repo_path: String,
    agent_type: String,
    models: Vec<ModelSelection>,
) -> Result<Task, String> {
    // Validation
    if name.trim().is_empty() {
        return Err("Task name cannot be empty".to_string());
    }

    if models.is_empty() {
        return Err("At least one model must be selected".to_string());
    }

    let task_id = generate_task_id(&name);
    let task_folder = get_task_folder_path(&task_id);
    let now = Utc::now().timestamp_millis();

    // Create task folder
    std::fs::create_dir_all(&task_folder)
        .map_err(|e| format!("Failed to create task folder: {}", e))?;

    // Determine the source reference for worktree creation
    let source_ref = match source_type.as_str() {
        "commit" => source_commit.clone(),
        _ => source_branch.clone(),
    };

    // Create agents with worktrees
    let mut agents = Vec::new();
    for (idx, model) in models.iter().enumerate() {
        let agent_id = format!("agent-{}", idx + 1);
        let worktree_name = format!("{}-{}", slugify(&name), slugify_model_id(&model.model_id));
        let worktree_path = task_folder.join(&worktree_name);
        let worktree_path_str = worktree_path.to_string_lossy().to_string();

        // Create the worktree at the specified path
        let created_path = worktree::create_worktree_at_path(
            &source_repo_path,
            &worktree_path_str,
            source_ref.as_deref(),
        )?;

        agents.push(TaskAgent {
            id: agent_id,
            model_id: model.model_id.clone(),
            provider_id: model.provider_id.clone(),
            agent_type: None,
            worktree_path: created_path,
            session_id: None,
            status: AgentStatus::Idle,
            accepted: false,
            created_at: now,
        });
    }

    let task = Task {
        id: task_id,
        name,
        source_type,
        source_branch,
        source_commit,
        source_repo_path,
        agent_type,
        status: TaskStatus::Idle,
        created_at: now,
        updated_at: now,
        agents,
    };

    // Save to store
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.tasks.push(task.clone());
    }
    state.save()?;

    println!("[task_manager] Created task: {}", task.id);
    Ok(task)
}

/// Get all tasks
pub fn get_tasks_impl(state: &TaskManagerState) -> Result<Vec<Task>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.tasks.clone())
}

/// Get a single task by ID
pub fn get_task_impl(state: &TaskManagerState, task_id: &str) -> Result<Task, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store
        .tasks
        .iter()
        .find(|t| t.id == task_id)
        .cloned()
        .ok_or_else(|| format!("Task not found: {}", task_id))
}

/// Update a task's properties
pub fn update_task_impl(
    state: &TaskManagerState,
    task_id: String,
    name: Option<String>,
    status: Option<TaskStatus>,
) -> Result<Task, String> {
    let task = {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        if let Some(n) = name {
            task.name = n;
        }
        if let Some(s) = status {
            task.status = s;
        }
        task.updated_at = Utc::now().timestamp_millis();

        task.clone()
    };

    state.save()?;
    Ok(task)
}

/// Delete a task and optionally its worktrees
pub fn delete_task_impl(
    state: &TaskManagerState,
    task_id: String,
    delete_worktrees: bool,
) -> Result<(), String> {
    let task = get_task_impl(state, &task_id)?;

    // Delete worktrees if requested
    if delete_worktrees {
        for agent in &task.agents {
            if std::path::Path::new(&agent.worktree_path).exists() {
                // Try to remove the worktree using git, ignore errors
                let _ = worktree::remove_worktree(&agent.worktree_path, true, false);
            }
        }

        // Also remove the task folder
        let task_folder = get_task_folder_path(&task_id);
        if task_folder.exists() {
            let _ = std::fs::remove_dir_all(&task_folder);
        }
    }

    // Remove from store
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.tasks.retain(|t| t.id != task_id);
    }
    state.save()?;

    println!("[task_manager] Deleted task: {}", task_id);
    Ok(())
}

// ============ Agent Management ============

/// Add a new agent to an existing task
pub fn add_agent_to_task_impl(
    state: &TaskManagerState,
    task_id: String,
    model_id: String,
    provider_id: String,
    agent_type: Option<String>,
) -> Result<Task, String> {
    let task = {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let now = Utc::now().timestamp_millis();
        let agent_num = task.agents.len() + 1;
        let agent_id = format!("agent-{}", agent_num);
        let worktree_name = format!("{}-{}", slugify(&task.name), slugify_model_id(&model_id));
        let task_folder = get_task_folder_path(&task_id);
        let worktree_path = task_folder.join(&worktree_name);
        let worktree_path_str = worktree_path.to_string_lossy().to_string();

        // Determine source for worktree
        let source_ref = match task.source_type.as_str() {
            "commit" => task.source_commit.clone(),
            _ => task.source_branch.clone(),
        };

        // Create the worktree
        let created_path = worktree::create_worktree_at_path(
            &task.source_repo_path,
            &worktree_path_str,
            source_ref.as_deref(),
        )?;

        task.agents.push(TaskAgent {
            id: agent_id,
            model_id,
            provider_id,
            agent_type,
            worktree_path: created_path,
            session_id: None,
            status: AgentStatus::Idle,
            accepted: false,
            created_at: now,
        });
        task.updated_at = now;

        task.clone()
    };

    state.save()?;
    println!("[task_manager] Added agent to task: {}", task_id);
    Ok(task)
}

/// Remove an agent from a task
pub fn remove_agent_from_task_impl(
    state: &TaskManagerState,
    task_id: String,
    agent_id: String,
    delete_worktree: bool,
) -> Result<(), String> {
    let worktree_path = {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent = task
            .agents
            .iter()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        let path = agent.worktree_path.clone();
        task.agents.retain(|a| a.id != agent_id);
        task.updated_at = Utc::now().timestamp_millis();

        path
    };

    // Delete worktree if requested
    if delete_worktree && std::path::Path::new(&worktree_path).exists() {
        worktree::remove_worktree(&worktree_path, true, false)?;
    }

    state.save()?;
    println!(
        "[task_manager] Removed agent {} from task {}",
        agent_id, task_id
    );
    Ok(())
}

/// Update an agent's session ID
pub fn update_agent_session_impl(
    state: &TaskManagerState,
    task_id: String,
    agent_id: String,
    session_id: Option<String>,
) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent = task
            .agents
            .iter_mut()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        agent.session_id = session_id;
        task.updated_at = Utc::now().timestamp_millis();
    }

    state.save()?;
    Ok(())
}

/// Update an agent's status
pub fn update_agent_status_impl(
    state: &TaskManagerState,
    task_id: String,
    agent_id: String,
    status: AgentStatus,
) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent = task
            .agents
            .iter_mut()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        agent.status = status;
        task.updated_at = Utc::now().timestamp_millis();
    }

    state.save()?;
    Ok(())
}

/// Mark an agent as accepted (winner)
pub fn accept_agent_impl(
    state: &TaskManagerState,
    task_id: String,
    agent_id: String,
) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        // Unaccept all agents first
        for agent in &mut task.agents {
            agent.accepted = false;
        }

        // Accept the specified agent
        let agent = task
            .agents
            .iter_mut()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        agent.accepted = true;
        task.updated_at = Utc::now().timestamp_millis();
    }

    state.save()?;
    println!(
        "[task_manager] Accepted agent {} in task {}",
        agent_id, task_id
    );
    Ok(())
}

/// Cleanup (delete) all unaccepted agents' worktrees
pub fn cleanup_unaccepted_agents_impl(
    state: &TaskManagerState,
    task_id: String,
) -> Result<(), String> {
    let agents_to_cleanup: Vec<(String, String)> = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        let task = store
            .tasks
            .iter()
            .find(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        task.agents
            .iter()
            .filter(|a| !a.accepted)
            .map(|a| (a.id.clone(), a.worktree_path.clone()))
            .collect()
    };

    // Remove worktrees
    for (_, worktree_path) in &agents_to_cleanup {
        if std::path::Path::new(worktree_path).exists() {
            let _ = worktree::remove_worktree(worktree_path, true, false);
        }
    }

    // Remove agents from task
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if let Some(task) = store.tasks.iter_mut().find(|t| t.id == task_id) {
            task.agents.retain(|a| a.accepted);
            task.updated_at = Utc::now().timestamp_millis();
        }
    }

    state.save()?;
    println!(
        "[task_manager] Cleaned up {} unaccepted agents from task {}",
        agents_to_cleanup.len(),
        task_id
    );
    Ok(())
}
