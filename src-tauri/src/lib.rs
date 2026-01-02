#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
pub mod models;

pub use commands::opencode_manager::OpenCodeManager;
pub use commands::task_manager::TaskManagerState;
pub use commands::{init_store, AppState};
