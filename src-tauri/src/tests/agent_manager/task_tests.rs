//! Task operation tests.

use crate::agent_manager::task_operations::{generate_task_id, slugify, slugify_model_id};

// ============================================================================
// ID generation tests
// ============================================================================

#[test]
fn test_generate_task_id_is_8_chars() {
    let id = generate_task_id("Test Task");
    assert_eq!(id.len(), 8);
}

#[test]
fn test_generate_task_id_is_hex() {
    let id = generate_task_id("Test Task");
    assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_generate_task_id_different_for_same_name() {
    // IDs should be different even for same name (because of timestamp)
    let id1 = generate_task_id("Same Name");
    std::thread::sleep(std::time::Duration::from_millis(1));
    let id2 = generate_task_id("Same Name");
    assert_ne!(id1, id2);
}

// ============================================================================
// Slugify tests
// ============================================================================

#[test]
fn test_slugify_basic() {
    assert_eq!(slugify("Hello World"), "hello-world");
}

#[test]
fn test_slugify_with_special_chars() {
    assert_eq!(
        slugify("Refactor Authentication!"),
        "refactor-authentication"
    );
}

#[test]
fn test_slugify_multiple_spaces() {
    assert_eq!(slugify("Hello   World"), "hello-world");
}

#[test]
fn test_slugify_numbers() {
    assert_eq!(slugify("Version 2.0 Release"), "version-2-0-release");
}

#[test]
fn test_slugify_model_id_basic() {
    assert_eq!(slugify_model_id("claude-sonnet-4"), "claude-sonnet-4");
}

#[test]
fn test_slugify_model_id_with_dots() {
    assert_eq!(slugify_model_id("gpt-4.0-turbo"), "gpt-4-0-turbo");
}

#[test]
fn test_slugify_model_id_preserves_hyphens() {
    assert_eq!(
        slugify_model_id("claude-3-5-sonnet-20241022"),
        "claude-3-5-sonnet-20241022"
    );
}
