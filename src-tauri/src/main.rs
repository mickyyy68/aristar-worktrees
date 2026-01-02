#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;

fn main() {
    println!("[main] Starting Aristar Worktrees...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::init_store())
        .invoke_handler(tauri::generate_handler![
            commands::get_repositories,
            commands::add_repository,
            commands::remove_repository,
            commands::refresh_repository,
            commands::list_worktrees,
            commands::create_worktree,
            commands::remove_worktree,
            commands::rename_worktree,
            commands::lock_worktree,
            commands::unlock_worktree,
            commands::get_branches,
            commands::get_commits,
            commands::open_in_terminal,
            commands::open_in_editor,
            commands::reveal_in_finder,
            commands::copy_to_clipboard,
        ])
        .setup(|_app| {
            println!("[main] App setup completed");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
