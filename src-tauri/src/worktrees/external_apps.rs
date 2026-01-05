//! External application integration (terminals, editors).

use std::process::Command;

/// Validate a custom command to prevent command injection.
/// Only allows absolute paths to known safe locations, no shell metacharacters.
fn validate_custom_command(cmd: &str) -> Result<(), String> {
    // Must be an absolute path
    if !cmd.starts_with('/') {
        return Err("Custom command must be an absolute path".to_string());
    }

    // Only allow commands from known safe locations
    let allowed_prefixes = [
        "/usr/bin/",
        "/usr/local/bin/",
        "/opt/homebrew/bin/",
        "/Applications/",
        "/System/Applications/",
    ];

    if !allowed_prefixes.iter().any(|p| cmd.starts_with(p)) {
        return Err(format!(
            "Custom command must be in one of: {:?}",
            allowed_prefixes
        ));
    }

    // Disallow shell metacharacters that could enable injection
    let forbidden_chars = ['|', ';', '&', '$', '`', '(', ')', '{', '}', '\n', '\r', '<', '>'];
    if cmd.chars().any(|c| forbidden_chars.contains(&c)) {
        return Err("Custom command contains forbidden characters".to_string());
    }

    // Verify the path exists and is executable
    let path = std::path::Path::new(cmd);
    if !path.exists() {
        return Err(format!("Custom command not found: {}", cmd));
    }

    Ok(())
}

/// Open a path in a terminal application.
pub fn open_in_terminal(path: &str, app: &str, custom_command: Option<&str>) -> Result<(), String> {
    let escaped_path = path.replace('"', "\\\"");

    match app {
        "terminal" => {
            let script = format!(
                "tell application \"Terminal\" to do script \"cd \\\"{}\\\" && clear\"",
                escaped_path
            );

            let output = Command::new("osascript")
                .arg("-e")
                .arg(&script)
                .output()
                .map_err(|e| e.to_string())?;

            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }
        }
        "ghostty" => {
            Command::new("open")
                .args(["-a", "Ghostty", path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "alacritty" => {
            let alacritty_paths = [
                "/opt/homebrew/bin/alacritty",
                "/usr/local/bin/alacritty",
                "/Applications/Alacritty.app/Contents/MacOS/alacritty",
            ];

            let alacritty_bin = alacritty_paths
                .iter()
                .find(|p| std::path::Path::new(p).exists())
                .ok_or_else(|| {
                    "Alacritty not found. Please install it via Homebrew or from alacritty.org"
                        .to_string()
                })?;

            // Try IPC first to create window in existing instance
            let msg_result = Command::new(alacritty_bin)
                .args(["msg", "create-window", "--working-directory", path])
                .output();

            match msg_result {
                Ok(output) if output.status.success() => {
                    // Success - window created in existing instance
                }
                _ => {
                    // No existing instance or IPC failed - spawn new one
                    Command::new(alacritty_bin)
                        .arg("--working-directory")
                        .arg(path)
                        .spawn()
                        .map_err(|e| e.to_string())?;
                }
            }
        }
        "kitty" => {
            let kitty_paths = [
                "/opt/homebrew/bin/kitty",
                "/usr/local/bin/kitty",
                "/Applications/kitty.app/Contents/MacOS/kitty",
            ];

            let kitty_bin = kitty_paths
                .iter()
                .find(|p| std::path::Path::new(p).exists())
                .ok_or_else(|| {
                    "Kitty not found. Please install it via Homebrew or from sw.kovidgoyal.net/kitty"
                        .to_string()
                })?;

            Command::new(kitty_bin)
                .arg("--single-instance")
                .arg("--directory")
                .arg(path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "iterm" => {
            let script = format!(
                "tell application \"iTerm2\" to create window with default profile command \"cd \\\"{}\\\" && clear\"",
                escaped_path
            );

            let output = Command::new("osascript")
                .arg("-e")
                .arg(&script)
                .output()
                .map_err(|e| e.to_string())?;

            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }
        }
        "warp" => {
            Command::new("open")
                .arg("-a")
                .arg("Warp")
                .arg(path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "custom" => {
            if let Some(cmd) = custom_command {
                // Validate custom command to prevent command injection
                validate_custom_command(cmd)?;
                Command::new(cmd)
                    .arg(path)
                    .spawn()
                    .map_err(|e| e.to_string())?;
            } else {
                return Err("custom_command is required when app is 'custom'".to_string());
            }
        }
        _ => {
            return Err(format!("Unknown terminal app: {}", app));
        }
    }

    Ok(())
}

/// Open a path in an editor application.
pub fn open_in_editor(path: &str, app: &str, custom_command: Option<&str>) -> Result<(), String> {
    match app {
        "vscode" => {
            Command::new("open")
                .args(["-a", "Visual Studio Code", path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "cursor" => {
            Command::new("open")
                .args(["-a", "Cursor", path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "zed" => {
            Command::new("open")
                .args(["-a", "Zed", path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "antigravity" => {
            Command::new("open")
                .args(["-a", "Antigravity", path])
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        "custom" => {
            if let Some(cmd) = custom_command {
                // Validate custom command to prevent command injection
                validate_custom_command(cmd)?;
                Command::new(cmd)
                    .arg(path)
                    .spawn()
                    .map_err(|e| e.to_string())?;
            } else {
                return Err("custom_command is required when app is 'custom'".to_string());
            }
        }
        _ => {
            return Err(format!("Unknown editor app: {}", app));
        }
    }

    Ok(())
}
