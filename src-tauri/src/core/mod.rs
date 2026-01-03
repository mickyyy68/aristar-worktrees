//! Core module - Shared infrastructure for the application.
//!
//! This module contains:
//! - Persistence utilities (store load/save)
//! - Shared types (AppSettings)
//! - System operations (clipboard, finder)

pub mod persistence;
pub mod system;
pub mod types;

pub use persistence::*;
pub use system::*;
pub use types::*;
