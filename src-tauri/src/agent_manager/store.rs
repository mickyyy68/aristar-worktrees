//! Task manager store state.

use std::sync::Mutex;

use super::task_operations::{load_tasks, save_tasks};
use super::types::TaskStoreData;

/// Task Manager state - holds in-memory task data.
#[derive(Default)]
pub struct TaskManagerState {
    pub store: Mutex<TaskStoreData>,
}

impl TaskManagerState {
    pub fn new() -> Self {
        Self {
            store: Mutex::new(load_tasks()),
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let store = self.store.lock().map_err(|e| e.to_string())?;
        save_tasks(&store)
    }
}
