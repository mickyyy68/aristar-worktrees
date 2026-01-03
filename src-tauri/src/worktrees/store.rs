//! Worktree store state management.

use std::sync::Mutex;

use crate::core::{get_store_path, load_json_store, save_json_store};

use super::types::StoreData;

/// Application state containing the worktree store.
pub struct AppState {
    pub store: Mutex<StoreData>,
}

impl AppState {
    /// Save the current store to disk.
    pub fn save(&self) -> Result<(), String> {
        let store = self.store.lock().map_err(|e| e.to_string())?;
        let path = get_store_path();
        save_json_store(&path, &*store)?;
        println!(
            "[persistence] Saved {} repositories to store",
            store.repositories.len()
        );
        Ok(())
    }
}

/// Initialize the worktree store from disk.
pub fn init_store() -> AppState {
    println!("[persistence] Initializing store...");
    let path = get_store_path();
    let data: StoreData = load_json_store(&path);
    println!(
        "[persistence] Loaded {} repositories from store",
        data.repositories.len()
    );
    AppState {
        store: Mutex::new(data),
    }
}
