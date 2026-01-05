# Core Module

> **TL;DR**: Shared infrastructure for persistence, system operations, and common types used across the application.

## Overview

The `core` module provides foundational utilities that are shared between the `worktrees` and `agent_manager` modules. It handles:

- **Persistence**: Loading and saving JSON store files
- **System Operations**: macOS-specific operations (clipboard, Finder)
- **Shared Types**: Common data structures like `AppSettings`

## File Structure

```
core/
├── mod.rs          # Module exports
├── persistence.rs  # Store load/save utilities
├── system.rs       # System operations (clipboard, finder)
├── types.rs        # Shared types (AppSettings)
└── README.md       # This file
```

## Types

### `AppSettings`

Application-wide settings stored in the persistent store.

```rust
pub struct AppSettings {
    pub theme: String,        // UI theme preference
    pub auto_refresh: bool,   // Auto-refresh repositories on focus
}
```

## Functions

### Persistence (`persistence.rs`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `get_aristar_worktrees_base` | `() -> PathBuf` | Returns `~/.aristar-worktrees` base directory |
| `get_store_path` | `() -> PathBuf` | Returns path to main store file (`store.json`) |
| `load_json_store<T>` | `(&PathBuf) -> T` | Load JSON file, returns `Default` on error |
| `save_json_store<T>` | `(&PathBuf, &T) -> Result<(), String>` | Save data as pretty-printed JSON |

#### Example Usage

```rust
use crate::core::{get_store_path, load_json_store, save_json_store};
use crate::worktrees::types::StoreData;

// Load store
let path = get_store_path();
let data: StoreData = load_json_store(&path);

// Save store
save_json_store(&path, &data)?;
```

### System Operations (`system.rs`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `reveal_in_finder` | `(&str) -> Result<(), String>` | Open Finder and select the file/folder |
| `copy_to_clipboard` | `(&str) -> Result<(), String>` | Copy text to system clipboard |

#### Platform Notes

These functions are **macOS-specific**:
- `reveal_in_finder` uses `open -R`
- `copy_to_clipboard` uses `pbcopy`

## Data Storage Locations

| Path | Purpose |
|------|---------|
| `~/.aristar-worktrees/` | Base directory for all app data |
| `~/.aristar-worktrees/store.json` | Repository and settings data |
| `~/.aristar-worktrees/tasks.json` | Task manager data |
| `~/.aristar-worktrees/tasks/` | Task worktree folders |
| `~/.aristar-worktrees/{hash}/` | Repository-specific worktrees |

## Error Handling

- `load_json_store`: Returns `T::default()` on any error (file not found, parse error)
- `save_json_store`: Returns `Result<(), String>` with descriptive error messages
- System operations return `Result<(), String>` with stderr output on failure
