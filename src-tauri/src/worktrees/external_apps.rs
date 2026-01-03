//! External application integration (terminals, editors).

use std::process::Command;

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
