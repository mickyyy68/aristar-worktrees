//! Worktrees module - Git worktree management.
//!
//! This module handles all git worktree operations including:
//! - Listing, creating, removing, renaming worktrees
//! - Branch and commit information
//! - External app integration (terminals, editors)
//! - Repository state management

pub mod commands;
pub mod external_apps;
pub mod operations;
pub mod store;
pub mod types;

// Re-export store init function (AppState is used via store:: prefix)
pub use store::init_store;
