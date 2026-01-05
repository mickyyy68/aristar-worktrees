//! Tests for OpenCode PID file management.
//!
//! These tests verify that PID tracking works correctly for process cleanup.
//! Note: Tests use serial execution to avoid race conditions on the shared PID file.

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use crate::agent_manager::opencode::{get_pid_file_path, remove_pid, save_pid};

// Use a mutex to serialize tests that access the PID file
static TEST_MUTEX: Mutex<()> = Mutex::new(());

// ============================================================================
// Helper to create a temporary PID file environment
// ============================================================================

/// Create a test environment by backing up and clearing the PID file.
fn setup_pid_test() -> Option<String> {
    let pid_file = get_pid_file_path();
    
    // Ensure parent directory exists
    if let Some(parent) = pid_file.parent() {
        let _ = fs::create_dir_all(parent);
    }
    
    // Backup existing content if any
    let backup = if pid_file.exists() {
        fs::read_to_string(&pid_file).ok()
    } else {
        None
    };
    
    // Clear the file for testing
    let _ = fs::write(&pid_file, "");
    
    backup
}

/// Restore the PID file after testing.
fn teardown_pid_test(backup: Option<String>) {
    let pid_file = get_pid_file_path();
    
    if let Some(content) = backup {
        let _ = fs::write(&pid_file, content);
    } else {
        // Just clear the file, don't remove it
        let _ = fs::write(&pid_file, "");
    }
}

// ============================================================================
// get_pid_file_path tests
// ============================================================================

#[test]
fn test_get_pid_file_path_is_absolute() {
    let path = get_pid_file_path();
    assert!(path.is_absolute(), "PID file path should be absolute");
}

#[test]
fn test_get_pid_file_path_has_correct_name() {
    let path = get_pid_file_path();
    assert_eq!(
        path.file_name().unwrap().to_str().unwrap(),
        "opencode.pids",
        "PID file should be named 'opencode.pids'"
    );
}

#[test]
fn test_get_pid_file_path_in_aristar_directory() {
    let path = get_pid_file_path();
    let parent = path.parent().unwrap();
    assert!(
        parent.to_string_lossy().contains("aristar-worktrees"),
        "PID file should be in aristar-worktrees directory"
    );
}

// ============================================================================
// save_pid tests
// ============================================================================

#[test]
fn test_save_pid_creates_file() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let backup = setup_pid_test();
    
    let test_path = Path::new("/test/worktree/path");
    save_pid(12345, test_path, 8080);
    
    let pid_file = get_pid_file_path();
    assert!(pid_file.exists(), "PID file should exist after save");
    
    let content = fs::read_to_string(&pid_file).unwrap();
    assert!(content.contains("12345"), "Should contain the PID");
    assert!(content.contains("8080"), "Should contain the port");
    assert!(content.contains("/test/worktree/path"), "Should contain the path");
    
    teardown_pid_test(backup);
}

#[test]
fn test_save_pid_appends_entries() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let backup = setup_pid_test();
    
    save_pid(11111, Path::new("/path/one"), 8081);
    save_pid(22222, Path::new("/path/two"), 8082);
    save_pid(33333, Path::new("/path/three"), 8083);
    
    let pid_file = get_pid_file_path();
    let content = fs::read_to_string(&pid_file).unwrap();
    let lines: Vec<&str> = content.lines().collect();
    
    assert_eq!(lines.len(), 3, "Should have 3 entries");
    assert!(content.contains("11111"), "Should contain first PID");
    assert!(content.contains("22222"), "Should contain second PID");
    assert!(content.contains("33333"), "Should contain third PID");
    
    teardown_pid_test(backup);
}

#[test]
fn test_save_pid_format() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let backup = setup_pid_test();
    
    save_pid(99999, Path::new("/my/worktree"), 9000);
    
    let pid_file = get_pid_file_path();
    let content = fs::read_to_string(&pid_file).unwrap();
    let line = content.lines().next().unwrap();
    
    // Format should be: PID|PORT|PATH
    let parts: Vec<&str> = line.split('|').collect();
    assert_eq!(parts.len(), 3, "Format should be PID|PORT|PATH");
    assert_eq!(parts[0], "99999", "First part should be PID");
    assert_eq!(parts[1], "9000", "Second part should be port");
    assert_eq!(parts[2], "/my/worktree", "Third part should be path");
    
    teardown_pid_test(backup);
}

// ============================================================================
// remove_pid tests
// ============================================================================

#[test]
fn test_remove_pid_removes_correct_entry() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let backup = setup_pid_test();
    
    // Add multiple entries
    save_pid(11111, Path::new("/path/one"), 8081);
    save_pid(22222, Path::new("/path/two"), 8082);
    save_pid(33333, Path::new("/path/three"), 8083);
    
    // Remove the middle one
    remove_pid(22222);
    
    let pid_file = get_pid_file_path();
    let content = fs::read_to_string(&pid_file).unwrap();
    
    assert!(content.contains("11111"), "Should still contain first PID");
    assert!(!content.contains("22222"), "Should NOT contain removed PID");
    assert!(content.contains("33333"), "Should still contain third PID");
    
    teardown_pid_test(backup);
}

#[test]
fn test_remove_pid_handles_nonexistent() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let backup = setup_pid_test();
    
    save_pid(11111, Path::new("/path/one"), 8081);
    
    // Try to remove a PID that doesn't exist
    remove_pid(99999);
    
    let pid_file = get_pid_file_path();
    let content = fs::read_to_string(&pid_file).unwrap();
    
    assert!(content.contains("11111"), "Original entry should remain");
    
    teardown_pid_test(backup);
}

#[test]
fn test_remove_pid_handles_empty_file() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let backup = setup_pid_test();
    
    // File exists but is empty (setup_pid_test already does this)
    let pid_file = get_pid_file_path();
    fs::write(&pid_file, "").unwrap();
    
    // Should not panic
    remove_pid(12345);
    
    teardown_pid_test(backup);
}

#[test]
fn test_remove_pid_handles_missing_file() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let pid_file = get_pid_file_path();
    
    // Ensure file doesn't exist
    let _ = fs::remove_file(&pid_file);
    
    // Should not panic
    remove_pid(12345);
    
    // Recreate empty file for other tests
    let _ = fs::write(&pid_file, "");
}

#[test]
fn test_remove_pid_preserves_similar_pids() {
    let _lock = TEST_MUTEX.lock().unwrap();
    let backup = setup_pid_test();
    
    // Add PIDs where one is a prefix of another
    save_pid(123, Path::new("/path/a"), 8081);
    save_pid(1234, Path::new("/path/b"), 8082);
    save_pid(12345, Path::new("/path/c"), 8083);
    
    // Remove only 123
    remove_pid(123);
    
    let pid_file = get_pid_file_path();
    let content = fs::read_to_string(&pid_file).unwrap();
    
    assert!(!content.contains("123|"), "Should remove PID 123");
    assert!(content.contains("1234|"), "Should keep PID 1234");
    assert!(content.contains("12345|"), "Should keep PID 12345");
    
    teardown_pid_test(backup);
}
