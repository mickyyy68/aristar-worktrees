#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod models;

use tauri::Manager;

fn main() {
    println!("[main] Starting Aristar Worktrees...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::init_store())
        .manage(commands::OpenCodeManager::new())
        .manage(commands::TaskManagerState::new())
        .invoke_handler(tauri::generate_handler![
            // Repository commands
            commands::get_repositories,
            commands::add_repository,
            commands::remove_repository,
            commands::refresh_repository,
            // Worktree commands
            commands::list_worktrees,
            commands::create_worktree,
            commands::remove_worktree,
            commands::rename_worktree,
            commands::lock_worktree,
            commands::unlock_worktree,
            commands::get_branches,
            commands::get_commits,
            // System commands
            commands::open_in_terminal,
            commands::open_in_editor,
            commands::reveal_in_finder,
            commands::copy_to_clipboard,
            // OpenCode commands (for worktrees)
            commands::start_opencode,
            commands::stop_opencode,
            commands::get_opencode_status,
            commands::is_opencode_running,
            // Task Manager commands
            commands::create_task,
            commands::get_tasks,
            commands::get_task,
            commands::update_task,
            commands::delete_task,
            commands::add_agent_to_task,
            commands::remove_agent_from_task,
            commands::update_agent_session,
            commands::update_agent_status,
            commands::accept_agent,
            commands::cleanup_unaccepted_agents,
            // Agent OpenCode commands
            commands::start_agent_opencode,
            commands::stop_agent_opencode,
            commands::get_agent_opencode_port,
            commands::stop_task_all_opencode,
        ])
        .setup(|_app| {
            println!("[main] App setup completed");
            Ok(())
        })
        .on_window_event(|_app, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(manager) = _app.try_state::<commands::OpenCodeManager>() {
                    println!("[main] Cleaning up OpenCode processes...");
                    manager.stop_all();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
