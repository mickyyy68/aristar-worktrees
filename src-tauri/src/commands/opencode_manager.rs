use portpicker::pick_unused_port;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

pub struct OpenCodeInstance {
    pub process: Child,
    pub port: u16,
    pub working_dir: PathBuf,
}

#[derive(Default)]
pub struct OpenCodeManager {
    instances: Mutex<HashMap<PathBuf, OpenCodeInstance>>,
}

impl OpenCodeManager {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }

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

        let child = Command::new("opencode")
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
            .map_err(|e| format!("Failed to start OpenCode server: {}", e))?;

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
            println!("[opencode] Server stopped successfully");
        } else {
            println!(
                "[opencode] No running server found for worktree: {}",
                worktree_path.display()
            );
        }

        Ok(())
    }

    pub fn stop_all(&self) {
        if let Ok(mut instances) = self.instances.lock() {
            for (_, mut instance) in instances.drain() {
                println!(
                    "[opencode] Stopping server on port {} during cleanup",
                    instance.port
                );
                let _ = instance.process.kill();
            }
        }
    }

    pub fn get_port(&self, worktree_path: &PathBuf) -> Result<Option<u16>, String> {
        let instances = self.instances.lock().map_err(|e| e.to_string())?;
        Ok(instances.get(worktree_path).map(|i| i.port))
    }

    pub fn is_running(&self, worktree_path: &PathBuf) -> bool {
        if let Ok(instances) = self.instances.lock() {
            instances.contains_key(worktree_path)
        } else {
            false
        }
    }
}
