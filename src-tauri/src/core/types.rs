//! Shared types used across modules.

use serde::{Deserialize, Serialize};

/// Application settings stored in the persistent store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme_name: String,
    pub color_scheme: String,
    pub auto_refresh: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme_name: "aristar".to_string(),
            color_scheme: "system".to_string(),
            auto_refresh: true,
        }
    }
}
