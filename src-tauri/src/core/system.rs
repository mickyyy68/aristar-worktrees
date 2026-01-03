//! System operations like clipboard and finder integration.

use std::io::Write;
use std::process::Command;

/// Reveal a path in Finder (macOS).
pub fn reveal_in_finder(path: &str) -> Result<(), String> {
    let output = Command::new("open")
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
    let mut child = Command::new("pbcopy")
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
