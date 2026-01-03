//! System operations like clipboard, finder, and logging.

use chrono::Local;
use std::io::Write;
use std::path::PathBuf;

/// Reveal a path in Finder (macOS).
pub fn reveal_in_finder(path: &str) -> Result<(), String> {
    let output = std::process::Command::new("open")
        .args(["-R", path])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

/// Copy text to the system clipboard (macOS).
pub fn copy_to_clipboard(text: &str) -> Result<(), String> {
    let mut child = std::process::Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    stdin
        .write_all(text.as_bytes())
        .map_err(|e| e.to_string())?;
    drop(stdin);

    child.wait().map_err(|e| e.to_string())?;

    Ok(())
}

/// Get the log file path for the application.
pub fn get_log_file_path() -> PathBuf {
    let logs_dir = dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
        .join("logs");

    if let Err(e) = std::fs::create_dir_all(&logs_dir) {
        eprintln!("[logger] Failed to create logs directory: {}", e);
    }

    let date = Local::now().format("%Y-%m-%d").to_string();
    logs_dir.join(format!("aristar-{}.log", date))
}

/// Append content to the log file with rotation support.
pub fn append_to_log_file(path: &str, content: &str) -> Result<(), String> {
    let path_buf = PathBuf::from(path);

    if let Some(parent) = path_buf.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            eprintln!("[logger] Failed to create log directory: {}", e);
            return Err(format!("Failed to create log directory: {}", e));
        }
    }

    std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path_buf)
        .map_err(|e| e.to_string())?
        .write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Rotate logs if the current log file exceeds the max size.
pub fn rotate_logs_if_needed(max_size: u64, max_files: usize) -> Result<(), String> {
    let logs_dir = dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
        .join("logs");

    if !logs_dir.exists() {
        return Ok(());
    }

    let log_pattern = format!("aristar-{}.log", Local::now().format("%Y-%m-%d"));
    let current_log = logs_dir.join(&log_pattern);

    if !current_log.exists() {
        return Ok(());
    }

    match std::fs::metadata(&current_log) {
        Ok(metadata) => {
            if metadata.len() >= max_size {
                rotate_logs(&logs_dir, &log_pattern, max_files)?;
            }
        }
        Err(e) => {
            eprintln!("[logger] Failed to get log file metadata: {}", e);
        }
    }

    Ok(())
}

fn rotate_logs(logs_dir: &PathBuf, log_pattern: &str, max_files: usize) -> Result<(), String> {
    let extension_len = 4; // .log
    let base_name = &log_pattern[..log_pattern.len() - extension_len];

    let mut existing_logs: Vec<(i64, PathBuf)> = Vec::new();

    for entry in std::fs::read_dir(logs_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        if file_name.starts_with(base_name) && file_name.ends_with(".log") {
            let timestamp = extract_log_timestamp(file_name, base_name);
            existing_logs.push((timestamp, path));
        }
    }

    existing_logs.sort_by(|a, b| b.0.cmp(&a.0));

    let current_log = logs_dir.join(log_pattern);
    let new_name = format!("{}.1.log", base_name);
    let new_path = logs_dir.join(&new_name);

    if new_path.exists() {
        if let Err(e) = std::fs::remove_file(&new_path) {
            eprintln!("[logger] Failed to remove old rotated log: {}", e);
        }
    }

    if let Err(e) = std::fs::rename(&current_log, &new_path) {
        eprintln!("[logger] Failed to rotate log: {}", e);
        return Err(format!("Failed to rotate log: {}", e));
    }

    let mut count = 1;
    while count < max_files {
        let old_name = format!("{}.{}.log", base_name, count);
        let new_name = format!("{}.{}.log", base_name, count + 1);
        let old_path = logs_dir.join(&old_name);
        let new_path = logs_dir.join(&new_name);

        if old_path.exists() {
            if new_path.exists() {
                if let Err(e) = std::fs::remove_file(&new_path) {
                    eprintln!("[logger] Failed to remove existing rotated log: {}", e);
                }
            }
            if let Err(e) = std::fs::rename(&old_path, &new_path) {
                eprintln!("[logger] Failed to rotate log {}: {}", count, e);
            }
        }

        count += 1;
    }

    Ok(())
}

fn extract_log_timestamp(file_name: &str, base_name: &str) -> i64 {
    let rest = file_name.strip_prefix(base_name).unwrap_or("");
    let num_str = rest.trim_start_matches('.').trim_end_matches(".log");

    if num_str.is_empty() {
        return 0;
    }

    num_str.parse::<i64>().unwrap_or(0)
}
