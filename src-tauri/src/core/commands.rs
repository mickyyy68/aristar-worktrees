//! Logger commands for file-based logging.

use crate::core::get_log_file_path as rust_get_log_file_path;

#[tauri::command]
pub fn get_log_file_path() -> String {
    rust_get_log_file_path().to_string_lossy().into_owned()
}

#[tauri::command]
pub fn append_to_log_file(path: String, content: String) -> Result<(), String> {
    crate::core::append_to_log_file(&path, &content)
}

#[tauri::command]
pub fn rotate_logs_if_needed(max_size: u64, max_files: usize) -> Result<(), String> {
    crate::core::rotate_logs_if_needed(max_size, max_files)
}
