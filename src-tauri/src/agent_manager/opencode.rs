//! OpenCode process manager.
//!
//! Manages OpenCode server instances for agent worktrees.

use dirs::home_dir;
use portpicker::pick_unused_port;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

fn find_opencode_binary() -> Option<PathBuf> {
    let standard_path = home_dir()?.join(".opencode").join("bin").join("opencode");

    if standard_path.exists() {
        return Some(standard_path);
    }

    if let Ok(path_var) = env::var("PATH") {
        for dir in env::split_paths(&path_var) {
            let candidate = dir.join("opencode");
            if candidate.exists() && is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }

    None
}

fn is_executable(path: &PathBuf) -> bool {
    #[cfg(unix)]
    {
        fs::metadata(path)
            .map(|m| m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(windows)]
    {
        true
    }
}

fn get_opencode_command() -> Result<PathBuf, String> {
    find_opencode_binary()
        .ok_or_else(|| "OpenCode binary not found. Expected at ~/.opencode/bin/opencode or in PATH. Please install OpenCode from https://opencode.ai".to_string())
}

/// Represents a running OpenCode server instance.
pub struct OpenCodeInstance {
    pub process: Child,
    pub port: u16,
    #[allow(dead_code)]
    pub working_dir: PathBuf,
}

/// Manages multiple OpenCode server instances.
#[derive(Default)]
pub struct OpenCodeManager {
    instances: Mutex<HashMap<PathBuf, OpenCodeInstance>>,
}

impl OpenCodeManager {
    pub fn new() -> Self {
        // Clean up any orphaned processes from previous crashes
        Self::cleanup_orphaned_processes();

        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }

    /// Start an OpenCode server for a worktree.
    pub fn start(&self, worktree_path: PathBuf) -> Result<u16, String> {
        let mut instances = self.instances.lock().map_err(|e| e.to_string())?;

        if let Some(instance) = instances.get(&worktree_path) {
            println!(
                "[opencode] Using existing instance on port {}",
                instance.port
            );
            return Ok(instance.port);
        }

        let port = pick_unused_port().ok_or("No available port for OpenCode server")?;

        println!(
            "[opencode] Starting server on port {} for worktree: {}",
            port,
            worktree_path.display()
        );

        let opencode_path = get_opencode_command()?;
        println!(
            "[opencode] Using OpenCode binary: {}",
            opencode_path.display()
        );

        let child = Command::new(&opencode_path)
            .args([
                "serve",
                "--port",
                &port.to_string(),
                "--hostname",
                "127.0.0.1",
            ])
            .current_dir(&worktree_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                format!(
                    "Failed to start OpenCode server ({}): {}",
                    opencode_path.display(),
                    e
                )
            })?;

        instances.insert(
            worktree_path.clone(),
            OpenCodeInstance {
                process: child,
                port,
                working_dir: worktree_path,
            },
        );

        println!("[opencode] Server started successfully on port {}", port);
        Ok(port)
    }

    /// Stop an OpenCode server for a worktree.
    pub fn stop(&self, worktree_path: &PathBuf) -> Result<(), String> {
        let mut instances = self.instances.lock().map_err(|e| e.to_string())?;

        if let Some(mut instance) = instances.remove(worktree_path) {
            println!(
                "[opencode] Stopping server on port {} for worktree: {}",
                instance.port,
                worktree_path.display()
            );
            instance
                .process
                .kill()
                .map_err(|e| format!("Failed to kill OpenCode process: {}", e))?;

            // Reap the zombie process to prevent resource leaks
            match instance.process.wait() {
                Ok(status) => println!("[opencode] Process exited with status: {}", status),
                Err(e) => println!("[opencode] Warning: Failed to wait for process: {}", e),
            }

            println!("[opencode] Server stopped successfully");
        } else {
            println!(
                "[opencode] No running server found for worktree: {}",
                worktree_path.display()
            );
        }

        Ok(())
    }

    /// Stop all running OpenCode servers.
    pub fn stop_all(&self) {
        if let Ok(mut instances) = self.instances.lock() {
            for (path, mut instance) in instances.drain() {
                println!(
                    "[opencode] Stopping server on port {} during cleanup",
                    instance.port
                );
                if let Err(e) = instance.process.kill() {
                    println!(
                        "[opencode] Warning: Failed to kill process for {}: {}",
                        path.display(),
                        e
                    );
                    continue;
                }

                // Reap the zombie process to prevent resource leaks
                match instance.process.wait() {
                    Ok(status) => println!(
                        "[opencode] Process for {} exited with status: {}",
                        path.display(),
                        status
                    ),
                    Err(e) => println!(
                        "[opencode] Warning: Failed to wait for process {}: {}",
                        path.display(),
                        e
                    ),
                }
            }
        }
    }

    /// Clean up orphaned OpenCode processes from previous crashes.
    /// This uses pkill to find and terminate any leftover `opencode serve` processes.
    pub fn cleanup_orphaned_processes() -> u32 {
        use std::process::Command;

        println!("[opencode] Checking for orphaned OpenCode processes...");

        // Use pgrep to find processes, then kill them
        // This is safer than pkill as we can count them first
        let pgrep_output = Command::new("pgrep")
            .args(["-f", "opencode serve"])
            .output();

        match pgrep_output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let pids: Vec<&str> = stdout.trim().lines().collect();
                let count = pids.len() as u32;

                if count > 0 {
                    println!(
                        "[opencode] Found {} orphaned process(es), cleaning up...",
                        count
                    );

                    // Kill the processes
                    let kill_result = Command::new("pkill").args(["-f", "opencode serve"]).output();

                    match kill_result {
                        Ok(status) if status.status.success() => {
                            println!("[opencode] Successfully cleaned up {} orphaned process(es)", count);
                        }
                        Ok(_) => {
                            println!("[opencode] pkill completed (some processes may have already exited)");
                        }
                        Err(e) => {
                            println!("[opencode] Warning: Failed to run pkill: {}", e);
                        }
                    }
                }

                count
            }
            Ok(_) => {
                // pgrep found no processes (exit code 1)
                println!("[opencode] No orphaned processes found");
                0
            }
            Err(e) => {
                println!("[opencode] Warning: Failed to check for orphaned processes: {}", e);
                0
            }
        }
    }

    /// Get the port for a worktree's OpenCode server, if running.
    pub fn get_port(&self, worktree_path: &PathBuf) -> Result<Option<u16>, String> {
        let instances = self.instances.lock().map_err(|e| e.to_string())?;
        Ok(instances.get(worktree_path).map(|i| i.port))
    }

    /// Check if an OpenCode server is running for a worktree.
    pub fn is_running(&self, worktree_path: &PathBuf) -> bool {
        if let Ok(instances) = self.instances.lock() {
            instances.contains_key(worktree_path)
        } else {
            false
        }
    }
}
