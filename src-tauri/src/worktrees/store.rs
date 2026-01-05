//! Worktree store state management.

use std::sync::RwLock;

use crate::core::{get_store_path, load_json_store, save_json_store};

use super::types::StoreData;

/// Application state containing the worktree store.
/// Uses RwLock instead of Mutex for better read concurrency.
/// Multiple readers can access the store simultaneously,
/// while writers get exclusive access.
pub struct AppState {
    pub store: RwLock<StoreData>,
}

impl AppState {
    /// Save the current store to disk.
    /// Requires a read lock since we're only reading the data to serialize it.
    pub fn save(&self) -> Result<(), String> {
        let store = self.store.read().map_err(|e| e.to_string())?;
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
        store: RwLock::new(data),
    }
}
