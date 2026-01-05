//! Security tests for worktree operations.
//!
//! Tests for path traversal prevention and command injection protection.

use tempfile::TempDir;

use crate::worktrees::external_apps::validate_custom_command;
use crate::worktrees::operations::{get_allowed_worktree_bases, validate_path_within_bases};

// ============================================================================
// validate_custom_command tests
// ============================================================================

#[test]
fn test_validate_custom_command_rejects_relative_path() {
    let result = validate_custom_command("vim");
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .contains("absolute path"));
}

#[test]
fn test_validate_custom_command_rejects_dot_relative_path() {
    let result = validate_custom_command("./my-editor");
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .contains("absolute path"));
}

#[test]
fn test_validate_custom_command_rejects_unknown_location() {
    // Path that starts with / but not in allowed locations
    let result = validate_custom_command("/tmp/evil-script");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("must be in one of"));
}

#[test]
fn test_validate_custom_command_rejects_home_directory() {
    // Home directory is not in the allowed list
    let result = validate_custom_command("/Users/attacker/evil");
    assert!(result.is_err());
}

#[test]
fn test_validate_custom_command_rejects_pipe_injection() {
    let result = validate_custom_command("/usr/bin/cat | rm -rf /");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("forbidden characters"));
}

#[test]
fn test_validate_custom_command_rejects_semicolon_injection() {
    let result = validate_custom_command("/usr/bin/echo; rm -rf /");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("forbidden characters"));
}

#[test]
fn test_validate_custom_command_rejects_ampersand_injection() {
    let result = validate_custom_command("/usr/bin/echo && rm -rf /");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("forbidden characters"));
}

#[test]
fn test_validate_custom_command_rejects_backtick_injection() {
    let result = validate_custom_command("/usr/bin/echo `rm -rf /`");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("forbidden characters"));
}

#[test]
fn test_validate_custom_command_rejects_dollar_injection() {
    let result = validate_custom_command("/usr/bin/echo $(rm -rf /)");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("forbidden characters"));
}

#[test]
fn test_validate_custom_command_rejects_newline_injection() {
    let result = validate_custom_command("/usr/bin/echo\nrm -rf /");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("forbidden characters"));
}

#[test]
fn test_validate_custom_command_rejects_redirect_injection() {
    let result = validate_custom_command("/usr/bin/echo > /etc/passwd");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("forbidden characters"));
}

#[test]
fn test_validate_custom_command_rejects_nonexistent_path() {
    // Valid location but file doesn't exist
    let result = validate_custom_command("/usr/bin/nonexistent-binary-12345");
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("not found"));
}

#[test]
fn test_validate_custom_command_accepts_valid_usr_bin() {
    // /usr/bin/env should exist on all macOS systems
    let result = validate_custom_command("/usr/bin/env");
    assert!(result.is_ok(), "Expected Ok but got: {:?}", result);
}

#[test]
fn test_validate_custom_command_accepts_valid_usr_local_bin() {
    // Only test if the path exists (may not on all systems)
    let path = "/usr/local/bin/";
    if std::path::Path::new(path).exists() {
        // Find any executable in /usr/local/bin/
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_file() {
                    let result = validate_custom_command(entry_path.to_str().unwrap());
                    assert!(result.is_ok(), "Expected Ok for {:?}", entry_path);
                    return;
                }
            }
        }
    }
    // Skip test if no suitable binary found
}

// ============================================================================
// validate_path_within_bases tests
// ============================================================================

#[test]
fn test_validate_path_within_bases_allows_path_in_base() {
    let temp = TempDir::new().unwrap();
    let base = temp.path().to_path_buf();
    
    // Create a file inside the base
    let file_path = base.join("test-file.txt");
    std::fs::write(&file_path, "test").unwrap();
    
    let result = validate_path_within_bases(&file_path, &[base]);
    assert!(result.is_ok(), "Expected Ok but got: {:?}", result);
}

#[test]
fn test_validate_path_within_bases_allows_nested_path() {
    let temp = TempDir::new().unwrap();
    let base = temp.path().to_path_buf();
    
    // Create nested directory structure
    let nested = base.join("level1").join("level2").join("level3");
    std::fs::create_dir_all(&nested).unwrap();
    let file_path = nested.join("deep-file.txt");
    std::fs::write(&file_path, "test").unwrap();
    
    let result = validate_path_within_bases(&file_path, &[base]);
    assert!(result.is_ok(), "Expected Ok but got: {:?}", result);
}

#[test]
fn test_validate_path_within_bases_rejects_outside_path() {
    let allowed_base = TempDir::new().unwrap();
    let outside_dir = TempDir::new().unwrap();
    
    // Create a file outside the allowed base
    let outside_file = outside_dir.path().join("outside-file.txt");
    std::fs::write(&outside_file, "test").unwrap();
    
    let result = validate_path_within_bases(&outside_file, &[allowed_base.path().to_path_buf()]);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("traversal detected"));
}

#[test]
fn test_validate_path_within_bases_rejects_parent_traversal() {
    let temp = TempDir::new().unwrap();
    let base = temp.path().join("allowed");
    std::fs::create_dir_all(&base).unwrap();
    
    // Try to escape with ..
    let traversal_path = base.join("..").join("..").join("etc").join("passwd");
    
    let result = validate_path_within_bases(&traversal_path, &[base.clone()]);
    assert!(result.is_err(), "Should reject parent traversal");
}

#[test]
fn test_validate_path_within_bases_rejects_symlink_escape() {
    let temp = TempDir::new().unwrap();
    let base = temp.path().join("allowed");
    std::fs::create_dir_all(&base).unwrap();
    
    // Create a symlink pointing outside
    let outside = temp.path().join("outside");
    std::fs::create_dir_all(&outside).unwrap();
    std::fs::write(outside.join("secret.txt"), "secret").unwrap();
    
    // Create symlink inside base pointing to outside
    let symlink_path = base.join("escape-link");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, &symlink_path).unwrap();
    
    #[cfg(unix)]
    {
        let target = symlink_path.join("secret.txt");
        let result = validate_path_within_bases(&target, &[base.clone()]);
        // After canonicalization, this should resolve outside the base
        assert!(result.is_err(), "Should reject symlink escape: {:?}", result);
    }
}

#[test]
fn test_validate_path_within_bases_allows_nonexistent_in_base() {
    let temp = TempDir::new().unwrap();
    let base = temp.path().to_path_buf();
    
    // Path doesn't exist yet but parent does
    let new_file = base.join("new-file.txt");
    
    let result = validate_path_within_bases(&new_file, &[base]);
    assert!(result.is_ok(), "Expected Ok for new file in base: {:?}", result);
}

#[test]
fn test_validate_path_within_bases_allows_nonexistent_nested() {
    let temp = TempDir::new().unwrap();
    let base = temp.path().to_path_buf();
    
    // Path with nonexistent parent directories
    let new_nested = base.join("new-dir").join("sub-dir").join("file.txt");
    
    let result = validate_path_within_bases(&new_nested, &[base]);
    assert!(result.is_ok(), "Expected Ok for new nested path: {:?}", result);
}

#[test]
fn test_validate_path_within_bases_with_multiple_bases() {
    let base1 = TempDir::new().unwrap();
    let base2 = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    
    // Create files in each base
    let file1 = base1.path().join("file1.txt");
    let file2 = base2.path().join("file2.txt");
    let file_outside = outside.path().join("outside.txt");
    
    std::fs::write(&file1, "test").unwrap();
    std::fs::write(&file2, "test").unwrap();
    std::fs::write(&file_outside, "test").unwrap();
    
    let bases = vec![base1.path().to_path_buf(), base2.path().to_path_buf()];
    
    // Both base paths should be allowed
    assert!(validate_path_within_bases(&file1, &bases).is_ok());
    assert!(validate_path_within_bases(&file2, &bases).is_ok());
    
    // Outside path should be rejected
    assert!(validate_path_within_bases(&file_outside, &bases).is_err());
}

// ============================================================================
// get_allowed_worktree_bases tests
// ============================================================================

#[test]
fn test_get_allowed_worktree_bases_not_empty() {
    let bases = get_allowed_worktree_bases();
    assert!(!bases.is_empty(), "Should have at least one allowed base");
}

#[test]
fn test_get_allowed_worktree_bases_includes_aristar_dir() {
    let bases = get_allowed_worktree_bases();
    let has_aristar = bases.iter().any(|p| {
        p.to_string_lossy().contains("aristar-worktrees")
    });
    assert!(has_aristar, "Should include aristar-worktrees directory");
}

#[test]
fn test_get_allowed_worktree_bases_includes_home() {
    let bases = get_allowed_worktree_bases();
    
    if let Some(home) = dirs::home_dir() {
        let has_home = bases.iter().any(|p| *p == home);
        assert!(has_home, "Should include home directory");
    }
}

#[test]
fn test_get_allowed_worktree_bases_all_absolute() {
    let bases = get_allowed_worktree_bases();
    for base in bases {
        assert!(base.is_absolute(), "All bases should be absolute paths: {:?}", base);
    }
}
