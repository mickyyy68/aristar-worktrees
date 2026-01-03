//! Shared types used across modules.

use serde::{Deserialize, Serialize};

/// Application settings stored in the persistent store.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub theme: String,
    pub auto_refresh: bool,
}
