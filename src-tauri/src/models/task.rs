//! Task and Agent types for the Agent Manager feature.
//!
//! These types represent tasks (goals/prompts) and the AI agents working on them.
//! Each task can have multiple agents, each with its own worktree.

use serde::{Deserialize, Serialize};

/// Status of a task
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    #[default]
    Idle,
    Running,
    Paused,
    Completed,
    Failed,
}

/// Status of an agent
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    #[default]
    Idle,
    Running,
    Paused,
    Completed,
    Failed,
}

/// Represents one AI model/agent working on a task.
/// Each agent has its own worktree and OpenCode session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskAgent {
    /// Unique ID within task (e.g., "agent-1")
    pub id: String,
    /// Model ID (e.g., "claude-sonnet-4")
    pub model_id: String,
    /// Provider ID (e.g., "anthropic")
    pub provider_id: String,
    /// Override task's default agent type
    pub agent_type: Option<String>,
    /// Full path to agent's worktree
    pub worktree_path: String,
    /// OpenCode session ID
    pub session_id: Option<String>,
    /// Current status
    pub status: AgentStatus,
    /// Whether this agent's output was accepted as the winner
    pub accepted: bool,
    /// Timestamp when agent was created (milliseconds since epoch)
    pub created_at: i64,
}

/// A task represents a goal/prompt with multiple agents working on it.
/// Each task has its own folder with agent worktrees inside.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    /// Unique 8-char hash (e.g., "a1b2c3d4")
    pub id: String,
    /// User-friendly name
    pub name: String,
    /// Source type: "branch" or "commit"
    pub source_type: String,
    /// Source branch name (when source_type is "branch")
    pub source_branch: Option<String>,
    /// Source commit hash (when source_type is "commit")
    pub source_commit: Option<String>,
    /// Original repository path
    pub source_repo_path: String,
    /// Default agent type for all agents (e.g., "build")
    pub agent_type: String,
    /// Current task status
    pub status: TaskStatus,
    /// Timestamp when task was created (milliseconds since epoch)
    pub created_at: i64,
    /// Timestamp when task was last updated (milliseconds since epoch)
    pub updated_at: i64,
    /// List of agents working on this task
    pub agents: Vec<TaskAgent>,
}

/// Model selection for creating agents
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSelection {
    pub provider_id: String,
    pub model_id: String,
}

/// Persistent storage for tasks
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskStoreData {
    pub tasks: Vec<Task>,
}
