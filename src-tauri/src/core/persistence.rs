//! Persistence utilities for loading and saving store data.

use std::path::PathBuf;

/// Get the base directory for all aristar worktrees (~/.aristar-worktrees)
pub fn get_aristar_worktrees_base() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
}

/// Get the path to the main store file (~/.aristar-worktrees/store.json)
pub fn get_store_path() -> PathBuf {
    get_aristar_worktrees_base().join("store.json")
}

/// Load store data from a JSON file, returning default if not found or on error.
pub fn load_json_store<T: serde::de::DeserializeOwned + Default>(path: &PathBuf) -> T {
    if !path.exists() {
        println!(
            "[persistence] No store file found at {:?}, using defaults",
            path
        );
        return T::default();
    }

    match std::fs::read_to_string(path) {
        Ok(contents) => match serde_json::from_str::<T>(&contents) {
            Ok(data) => {
                println!("[persistence] Loaded data from {:?}", path);
                data
            }
            Err(e) => {
                eprintln!("[persistence] Failed to parse store file {:?}: {}", path, e);
                T::default()
            }
        },
        Err(e) => {
            eprintln!("[persistence] Failed to read store file {:?}: {}", path, e);
            T::default()
        }
    }
}

/// Save store data to a JSON file.
pub fn save_json_store<T: serde::Serialize>(path: &PathBuf, data: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create store directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize store data: {}", e))?;

    std::fs::write(path, json).map_err(|e| format!("Failed to write store file: {}", e))?;

    println!("[persistence] Saved data to {:?}", path);
    Ok(())
}
