//! Agent management operations.

use chrono::Utc;

use crate::worktrees::operations as worktree_ops;

use super::store::TaskManagerState;
use super::task_operations::{get_task_folder_path, slugify, slugify_model_id};
use super::types::{AgentStatus, Task, TaskAgent};

/// Add a new agent to an existing task.
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
        let created_path = worktree_ops::create_worktree_at_path(
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

/// Remove an agent from a task.
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
        worktree_ops::remove_worktree(&worktree_path, true, false)?;
    }

    state.save()?;
    println!(
        "[task_manager] Removed agent {} from task {}",
        agent_id, task_id
    );
    Ok(())
}

/// Update an agent's session ID.
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

/// Update an agent's status.
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

/// Mark an agent as accepted (winner).
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

/// Validate worktrees for a task - returns list of agent IDs with missing worktrees.
pub fn validate_task_worktrees_impl(
    state: &TaskManagerState,
    task_id: String,
) -> Result<Vec<String>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let task = store
        .tasks
        .iter()
        .find(|t| t.id == task_id)
        .ok_or_else(|| format!("Task not found: {}", task_id))?;

    let orphaned_agents: Vec<String> = task
        .agents
        .iter()
        .filter(|a| !std::path::Path::new(&a.worktree_path).exists())
        .map(|a| a.id.clone())
        .collect();

    if !orphaned_agents.is_empty() {
        println!(
            "[task_manager] Found {} orphaned agents in task {}",
            orphaned_agents.len(),
            task_id
        );
    }

    Ok(orphaned_agents)
}

/// Recreate a worktree for an orphaned agent.
pub fn recreate_agent_worktree_impl(
    state: &TaskManagerState,
    task_id: String,
    agent_id: String,
) -> Result<String, String> {
    let (source_repo_path, source_ref, worktree_path) = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
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

        // Check if worktree already exists
        if std::path::Path::new(&agent.worktree_path).exists() {
            return Err("Worktree already exists".to_string());
        }

        let source_ref = match task.source_type.as_str() {
            "commit" => task.source_commit.clone(),
            _ => task.source_branch.clone(),
        };

        (
            task.source_repo_path.clone(),
            source_ref,
            agent.worktree_path.clone(),
        )
    };

    // Create the worktree
    let created_path = worktree_ops::create_worktree_at_path(
        &source_repo_path,
        &worktree_path,
        source_ref.as_deref(),
    )?;

    println!(
        "[task_manager] Recreated worktree for agent {} in task {}",
        agent_id, task_id
    );

    Ok(created_path)
}

/// Cleanup (delete) all unaccepted agents' worktrees.
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
            let _ = worktree_ops::remove_worktree(worktree_path, true, false);
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
