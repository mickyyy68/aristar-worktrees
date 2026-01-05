#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

pub mod agent_manager;
pub mod core;
pub mod worktrees;

#[cfg(test)]
mod tests;

// Re-export commonly used types and functions
pub use agent_manager::{OpenCodeManager, TaskManagerState};
pub use worktrees::init_store;
pub use worktrees::store::AppState;
