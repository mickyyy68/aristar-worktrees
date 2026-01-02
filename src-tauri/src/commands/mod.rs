#![allow(dead_code)]

use chrono::Utc;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

pub mod worktree;

#[cfg(test)]
mod tests;

use worktree::{CommitInfo, Repository, StoreData, WorktreeInfo};

fn get_store_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".aristar-worktrees")
        .join("store.json")
}

fn load_store_data() -> StoreData {
    let store_path = get_store_path();

    if !store_path.exists() {
        println!("[persistence] No store file found, using defaults");
        return StoreData::default();
    }

    match std::fs::read_to_string(&store_path) {
        Ok(contents) => match serde_json::from_str::<StoreData>(&contents) {
            Ok(data) => {
                println!(
                    "[persistence] Loaded {} repositories from store",
                    data.repositories.len()
                );
                data
            }
            Err(e) => {
                eprintln!("[persistence] Failed to parse store file: {}", e);
                StoreData::default()
            }
        },
        Err(e) => {
            eprintln!("[persistence] Failed to read store file: {}", e);
            StoreData::default()
        }
    }
}

fn save_store_data(data: &StoreData) -> Result<(), String> {
    let store_path = get_store_path();

    if let Some(parent) = store_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create store directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize store data: {}", e))?;

    std::fs::write(&store_path, json).map_err(|e| format!("Failed to write store file: {}", e))?;

    println!(
        "[persistence] Saved {} repositories to store",
        data.repositories.len()
    );
    Ok(())
}

pub struct AppState {
    pub store: Mutex<StoreData>,
}

impl AppState {
    fn save(&self) -> Result<(), String> {
        let store = self.store.lock().map_err(|e| e.to_string())?;
        save_store_data(&store)
    }
}

#[tauri::command]
pub fn get_repositories(state: State<AppState>) -> Result<Vec<Repository>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.repositories.clone())
}

#[tauri::command]
pub fn add_repository(state: State<AppState>, path: String) -> Result<Repository, String> {
    println!("[add_repository] Called with path: {}", path);
    let abs_path = Path::new(&path)
        .canonicalize()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    if !worktree::is_git_repository(&abs_path) {
        return Err("Not a valid git repository".to_string());
    }

    let worktrees = worktree::list_worktrees(&abs_path)?;

    let repo = Repository {
        id: uuid::Uuid::new_v4().to_string(),
        path: abs_path.clone(),
        name: worktree::get_repository_name(&abs_path),
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
            let worktrees = worktree::list_worktrees(&repo.path)?;
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
    worktree::list_worktrees(&repo_path)
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
    let new_worktree = worktree::create_worktree(
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
    worktree::remove_worktree(&path, force, delete_branch)?;

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
    let renamed_worktree = worktree::rename_worktree(&old_path, &new_name)?;

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
    worktree::lock_worktree(&path, reason.as_deref())?;

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
    worktree::unlock_worktree(&path)?;

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
pub fn get_branches(repo_path: String) -> Result<Vec<worktree::BranchInfo>, String> {
    worktree::get_branches(&repo_path)
}

#[tauri::command]
pub fn get_commits(repo_path: String, limit: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    worktree::get_commits(&repo_path, limit.unwrap_or(50))
}

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    worktree::open_in_terminal(&path)
}

#[tauri::command]
pub fn open_in_editor(path: String) -> Result<(), String> {
    worktree::open_in_editor(&path)
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    worktree::reveal_in_finder(&path)
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    worktree::copy_to_clipboard(&text)
}

pub fn init_store() -> AppState {
    println!("[persistence] Initializing store...");
    let data = load_store_data();
    AppState {
        store: Mutex::new(data),
    }
}
