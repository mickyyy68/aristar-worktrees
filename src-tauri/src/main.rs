#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod agent_manager;
mod core;
mod worktrees;

#[cfg(test)]
mod tests;

use std::fs;
use tauri::{Manager, RunEvent};

fn main() {
    println!("[main] Starting Aristar Worktrees...");

    let worktrees_base = worktrees::get_aristar_worktrees_base();
    if !worktrees_base.exists() {
        println!("[main] Creating worktrees directory: {:?}", worktrees_base);
        if let Err(e) = fs::create_dir_all(&worktrees_base) {
            eprintln!("[main] ERROR: Failed to create worktrees directory: {}", e);
            eprintln!("[main] This may cause issues when saving repository data.");
        }
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(worktrees::init_store())
        .manage(agent_manager::OpenCodeManager::new())
        .manage(agent_manager::TaskManagerState::new())
        .invoke_handler(tauri::generate_handler![
            // Repository commands
            worktrees::commands::get_repositories,
            worktrees::commands::add_repository,
            worktrees::commands::remove_repository,
            worktrees::commands::refresh_repository,
            // Worktree commands
            worktrees::commands::list_worktrees,
            worktrees::commands::create_worktree,
            worktrees::commands::remove_worktree,
            worktrees::commands::rename_worktree,
            worktrees::commands::lock_worktree,
            worktrees::commands::unlock_worktree,
            worktrees::commands::get_branches,
            worktrees::commands::get_commits,
            // System commands
            worktrees::commands::open_in_terminal,
            worktrees::commands::open_in_editor,
            worktrees::commands::reveal_in_finder,
            worktrees::commands::copy_to_clipboard,
            // OpenCode commands (for worktrees)
            agent_manager::commands::start_opencode,
            agent_manager::commands::stop_opencode,
            agent_manager::commands::get_opencode_status,
            agent_manager::commands::is_opencode_running,
            // Task Manager commands
            agent_manager::commands::create_task,
            agent_manager::commands::get_tasks,
            agent_manager::commands::get_task,
            agent_manager::commands::update_task,
            agent_manager::commands::delete_task,
            agent_manager::commands::add_agent_to_task,
            agent_manager::commands::remove_agent_from_task,
            agent_manager::commands::update_agent_session,
            agent_manager::commands::update_agent_status,
            agent_manager::commands::accept_agent,
            agent_manager::commands::cleanup_unaccepted_agents,
            // Agent OpenCode commands
            agent_manager::commands::start_agent_opencode,
            agent_manager::commands::stop_agent_opencode,
            agent_manager::commands::get_agent_opencode_port,
            agent_manager::commands::stop_task_all_opencode,
            // Worktree validation commands
            agent_manager::commands::validate_task_worktrees,
            agent_manager::commands::recreate_agent_worktree,
            // Process cleanup commands
            agent_manager::commands::cleanup_orphaned_opencode_processes,
            // Logger commands
            core::commands::get_log_file_path,
            core::commands::append_to_log_file,
            core::commands::rotate_logs_if_needed,
        ])
        .setup(|_app| {
            println!("[main] App setup completed");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        match event {
            RunEvent::Exit => {
                println!("[main] App exiting, cleaning up OpenCode processes...");
                if let Some(manager) = app_handle.try_state::<agent_manager::OpenCodeManager>() {
                    manager.stop_all();
                }
                println!("[main] Cleanup complete");
            }
            _ => {}
        }
    });
}
