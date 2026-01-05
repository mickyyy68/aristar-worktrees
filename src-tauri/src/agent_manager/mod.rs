//! Agent Manager module - AI agent orchestration.
//!
//! This module handles task and agent management including:
//! - Task CRUD operations
//! - Agent management (add, remove, update status)
//! - OpenCode process management
//! - Worktree creation for agents

pub mod agent_operations;
pub mod commands;
pub mod opencode;
pub mod store;
pub mod task_operations;
pub mod types;

// Re-export commonly used types
pub use opencode::OpenCodeManager;
pub use store::TaskManagerState;
