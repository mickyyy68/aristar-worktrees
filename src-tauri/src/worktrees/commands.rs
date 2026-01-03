//! Tauri commands for worktree operations.

use chrono::Utc;
use std::path::Path;
use tauri::State;

use crate::core::{
    copy_to_clipboard as core_copy_to_clipboard, reveal_in_finder as core_reveal_in_finder,
};

use super::external_apps::{
    open_in_editor as ext_open_in_editor, open_in_terminal as ext_open_in_terminal,
};
use super::operations;
use super::store::AppState;
use super::types::{BranchInfo, CommitInfo, Repository, WorktreeInfo};

#[tauri::command]
pub fn get_repositories(state: State<AppState>) -> Result<Vec<Repository>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.repositories.clone())
}

#[tauri::command]
pub fn add_repository(state: State<AppState>, path: String) -> Result<Repository, String> {
    println!("[add_repository] Called with path: {}", path);

    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !path_obj.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let abs_path = path_obj
        .canonicalize()
        .map_err(|e| format!("Failed to resolve path '{}': {}", path, e))?
        .to_string_lossy()
        .to_string();

    if !operations::is_git_repository(&abs_path) {
        return Err("Not a valid git repository".to_string());
    }

    let worktrees = operations::list_worktrees(&abs_path)?;

    let repo = Repository {
        id: uuid::Uuid::new_v4().to_string(),
        path: abs_path.clone(),
        name: operations::get_repository_name(&abs_path),
        worktrees,
        last_scanned: Utc::now().timestamp_millis(),
    };

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if store.repositories.iter().any(|r| r.path == repo.path) {
            return Err("Repository already added".to_string());
        }
        store.repositories.push(repo.clone());
    }

    state.save()?;
    Ok(repo)
}

#[tauri::command]
pub fn remove_repository(state: State<AppState>, id: String) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.repositories.retain(|r| r.id != id);
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn refresh_repository(state: State<AppState>, id: String) -> Result<Repository, String> {
    let repo = {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if let Some(repo) = store.repositories.iter_mut().find(|r| r.id == id) {
            let worktrees = operations::list_worktrees(&repo.path)?;
            repo.worktrees = worktrees;
            repo.last_scanned = Utc::now().timestamp_millis();
            repo.clone()
        } else {
            return Err("Repository not found".to_string());
        }
    };

    state.save()?;
    Ok(repo)
}

#[tauri::command]
pub fn list_worktrees(repo_path: String) -> Result<Vec<WorktreeInfo>, String> {
    operations::list_worktrees(&repo_path)
}

#[tauri::command]
pub fn create_worktree(
    state: State<AppState>,
    repo_path: String,
    name: String,
    branch: Option<String>,
    commit: Option<String>,
    startup_script: Option<String>,
    execute_script: bool,
) -> Result<WorktreeInfo, String> {
    let new_worktree = operations::create_worktree(
        &repo_path,
        &name,
        branch.as_deref(),
        commit.as_deref(),
        startup_script.as_deref(),
        execute_script,
    )?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if let Some(repo) = store.repositories.iter_mut().find(|r| r.path == repo_path) {
            if !repo.worktrees.iter().any(|w| w.path == new_worktree.path) {
                repo.worktrees.push(new_worktree.clone());
            }
        }
    }

    state.save()?;
    Ok(new_worktree)
}

#[tauri::command]
pub fn remove_worktree(
    state: State<AppState>,
    path: String,
    force: bool,
    delete_branch: bool,
) -> Result<(), String> {
    operations::remove_worktree(&path, force, delete_branch)?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            repo.worktrees.retain(|w| w.path != path);
        }
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn rename_worktree(
    state: State<AppState>,
    old_path: String,
    new_name: String,
) -> Result<WorktreeInfo, String> {
    let renamed_worktree = operations::rename_worktree(&old_path, &new_name)?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            if let Some(idx) = repo.worktrees.iter().position(|w| w.path == old_path) {
                repo.worktrees[idx] = renamed_worktree.clone();
                break;
            }
        }
    }

    state.save()?;
    Ok(renamed_worktree)
}

#[tauri::command]
pub fn lock_worktree(
    state: State<AppState>,
    path: String,
    reason: Option<String>,
) -> Result<(), String> {
    operations::lock_worktree(&path, reason.as_deref())?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            if let Some(wt) = repo.worktrees.iter_mut().find(|w| w.path == path) {
                wt.is_locked = true;
                wt.lock_reason = reason.clone();
                break;
            }
        }
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn unlock_worktree(state: State<AppState>, path: String) -> Result<(), String> {
    operations::unlock_worktree(&path)?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        for repo in &mut store.repositories {
            if let Some(wt) = repo.worktrees.iter_mut().find(|w| w.path == path) {
                wt.is_locked = false;
                wt.lock_reason = None;
                break;
            }
        }
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub fn get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    operations::get_branches(&repo_path)
}

#[tauri::command]
pub fn get_commits(repo_path: String, limit: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    operations::get_commits(&repo_path, limit.unwrap_or(50))
}

#[tauri::command]
pub fn open_in_terminal(
    path: String,
    app: String,
    custom_command: Option<String>,
) -> Result<(), String> {
    ext_open_in_terminal(&path, &app, custom_command.as_deref())
}

#[tauri::command]
pub fn open_in_editor(
    path: String,
    app: String,
    custom_command: Option<String>,
) -> Result<(), String> {
    ext_open_in_editor(&path, &app, custom_command.as_deref())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    core_reveal_in_finder(&path)
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    core_copy_to_clipboard(&text)
}
