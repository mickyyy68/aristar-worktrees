# Resource Cleanup Implementation Backlog

A comprehensive plan to fix resource leaks in the Aristar Worktrees application.

## Overview

This plan addresses critical resource cleanup issues discovered during code review:
- Zombie processes from un-reaped child processes
- EventSource connections that never close
- Event handler memory leaks
- Module-level Maps that grow indefinitely
- Missing React app shutdown cleanup
- No cleanup for orphaned processes from crashes

---

## Phase 1: Rust Backend Process Cleanup

### [ ] 1.1 Add `wait()` call after `kill()` in `stop()` method
**File**: `src-tauri/src/agent_manager/opencode.rs`
**Lines**: ~133-155

**Task**: After calling `instance.process.kill()`, add a blocking `wait()` to reap the zombie process.

```rust
// Current code (problematic):
instance.process.kill()?;

// Should become:
instance.process.kill()?;
instance.process.wait()?;  // Add this line
```

**Acceptance Criteria**:
- Process is properly reaped after being killed
- Error is logged if `wait()` fails (but doesn't cause function to fail)
- Tests verify no zombie processes after agent stop

---

### [ ] 1.2 Add `wait()` call after `kill()` in `stop_all()` method
**File**: `src-tauri/src/agent_manager/opencode.rs`
**Lines**: ~158-168

**Task**: Same fix as 1.1 but for the `stop_all()` bulk shutdown method.

**Acceptance Criteria**:
- All processes are properly reaped during app shutdown
- Error handling doesn't block cleanup of other processes
- Logs show each process exit status

---

### [ ] 1.3 Create helper function `cleanup_orphaned_opencode_processes()`
**File**: `src-tauri/src/agent_manager/opencode.rs`
**Lines**: New function after `stop_all()`

**Task**: Create a function that uses `pkill -f "opencode serve"` to clean up orphaned processes from crashes.

```rust
fn cleanup_orphaned_opencode_processes() {
    // Use Command to run pkill
    // Log results without failing if pkill isn't available
    // Consider using a more targeted approach with port scanning
}
```

**Acceptance Criteria**:
- Function compiles and runs without errors
- Detects and cleans up orphaned processes
- Handles case where pkill isn't available (macOS always has it)

---

### [ ] 1.4 Call orphaned process cleanup on manager startup
**File**: `src-tauri/src/agent_manager/opencode.rs`
**Lines**: In `OpenCodeManager::new()`

**Task**: Call `cleanup_orphaned_opencode_processes()` when the manager is created.

```rust
pub fn new() -> Self {
    cleanup_orphaned_opencode_processes();
    Self {
        instances: Mutex::new(HashMap::new()),
    }
}
```

**Acceptance Criteria**:
- Orphaned processes are cleaned on app startup
- Doesn't interfere with normal process management

---

### [ ] 1.5 Add `OrphanedProcessesDialog` component for persistent notification
**File**: `src/modules/core/components/orphaned-processes-dialog.tsx` (new file)

**Task**: Create a dialog component that:
- Shows a warning about orphaned processes found
- Has "Clean Up" and "Dismiss" buttons
- Does NOT auto-dismiss
- Persists until user takes action

```typescript
interface OrphanedProcessesDialogProps {
  orphanedCount: number;
  onCleanUp: () => void;
  onDismiss: () => void;
}
```

**Acceptance Criteria**:
- Dialog displays count of orphaned processes found
- Clean Up button triggers cleanup via Tauri command
- Dismiss button acknowledges but keeps notification state
- Dialog can be re-opened from settings if dismissed

---

### [ ] 1.6 Create Tauri command `cleanup_orphaned_processes()`
**File**: `src-tauri/src/agent_manager/commands.rs`
**Lines**: New command function

**Task**: Create a Tauri command that:
- Runs `pkill -f "opencode serve"` on macOS
- Returns count of processes killed
- Can be called from frontend

```rust
#[tauri::command]
pub fn cleanup_orphaned_processes() -> Result<u32, String> {
    // Execute pkill and count killed processes
    // Return count for UI display
}
```

**Acceptance Criteria**:
- Command is exposed to frontend
- Returns accurate count of cleaned processes
- Handles errors gracefully

---

### [ ] 1.7 Store orphaned cleanup state in app persistence
**File**: `src/modules/core/components/orphaned-processes-dialog.tsx` or use-app-store

**Task**: Track whether user has been notified about orphaned processes:
- Use localStorage to persist "has seen orphaned notification"
- Don't show dialog again until new orphaned processes are detected
- Allow user to reset from settings

**Acceptance Criteria**:
- Dialog doesn't show on every app start
- New orphaned processes trigger new notification
- User can reset from settings

---

## Phase 2: Event Handler Leak Fix

### [ ] 2.1 Fix `registerEventHandler()` to delete before set
**File**: `src/modules/agent-manager/api/opencode.ts`
**Lines**: ~771-780

**Task**: Modify `registerEventHandler` to remove existing handler before setting new one.

```typescript
// Current code (problematic):
this.eventHandlers.set(agentKey, handler);

// Should become:
const existing = this.eventHandlers.get(agentKey);
if (existing) {
  // Just delete - no explicit cleanup needed, reference will be GC'd
  this.eventHandlers.delete(agentKey);
}
this.eventHandlers.set(agentKey, handler);
```

**Acceptance Criteria**:
- Old handlers are removed from Map when overwritten
- No memory leak from accumulated handlers
- Log when handlers are replaced (for debugging)

---

### [ ] 2.2 Add logging for handler registration/replacement
**File**: `src/modules/agent-manager/api/opencode.ts`
**Lines**: In `registerEventHandler()`

**Task**: Add console logs to track handler lifecycle.

```typescript
registerEventHandler(agentKey: string, handler: (event: any) => void): () => void {
  const existing = this.eventHandlers.get(agentKey);
  if (existing) {
    console.log(`[OpenCodeClientManager] Replacing handler for ${agentKey}`);
  } else {
    console.log(`[OpenCodeClientManager] Registering new handler for ${agentKey}`);
  }
  // ... rest of function
}
```

**Acceptance Criteria**:
- Debug logs show when handlers are registered/replaced
- Helps with debugging future issues

---

## Phase 3: Module-Level Map Cleanup

### [ ] 3.1 Create `cleanupAgentManagerResources()` export function
**File**: `src/modules/agent-manager/store/agent-manager-store.ts`
**Lines**: New function near line 37

**Task**: Export a function that cleans up module-level Maps.

```typescript
export function cleanupAgentManagerResources(): void {
  // Call all SSE unsubscribe functions
  for (const [agentKey, unsub] of sseUnsubscribers.entries()) {
    try {
      unsub();
    } catch (e) {
      console.error(`Error unsubscribing ${agentKey}:`, e);
    }
  }
  sseUnsubscribers.clear();
  agentsBeingRecovered.clear();
}
```

**Acceptance Criteria**:
- Function is exported and can be called from main.tsx
- All subscriptions are properly unsubscribed
- Maps are cleared after cleanup

---

### [ ] 3.2 Update `removeAgentFromTask()` to clean module Maps
**File**: `src/modules/agent-manager/store/agent-manager-store.ts`
**Lines**: ~382-429 (in `removeAgentFromTask` action)

**Task**: Add cleanup for `sseUnsubscribers` and `agentsBeingRecovered` when removing an agent.

```typescript
// Already has cleanup for sseUnsubscribers - verify and add agentsBeingRecovered
const agentKey = getAgentKey(taskId, agentId);

// Clean up recovery tracking
agentsBeingRecovered.delete(agentKey);
```

**Acceptance Criteria**:
- `agentsBeingRecovered` entry is removed when agent is deleted
- No orphaned entries in either Map after agent removal

---

### [ ] 3.3 Update `deleteTask()` to clean module Maps for all agents
**File**: `src/modules/agent-manager/store/agent-manager-store.ts`
**Lines**: ~328-360 (in `deleteTask` action)

**Task**: Add cleanup for both Maps for all agents in the task before deletion.

```typescript
// Add loop before existing cleanup code
if (task) {
  for (const agent of task.agents) {
    const agentKey = getAgentKey(taskId, agent.id);
    const unsub = sseUnsubscribers.get(agentKey);
    if (unsub) {
      unsub();
      sseUnsubscribers.delete(agentKey);
    }
    agentsBeingRecovered.delete(agentKey);
  }
}
```

**Acceptance Criteria**:
- All module-level Maps are cleaned when task is deleted
- No memory growth from repeated task creation/deletion

---

### [ ] 3.4 Update `stopAgent()` to clean module Maps
**File**: `src/modules/agent-manager/store/agent-manager-store.ts`
**Lines**: ~657-701 (in `stopAgent` action)

**Task**: Add cleanup for `agentsBeingRecovered` when stopping an agent.

```typescript
// Add after existing cleanup
agentsBeingRecovered.delete(agentKey);
```

**Acceptance Criteria**:
- Recovery tracking is cleaned when agent is stopped
- Agent can be restarted without recovery conflicts

---

## Phase 4: React Shutdown Cleanup

### [ ] 4.1 Add cleanup handlers to `main.tsx`
**File**: `src/main.tsx`

**Task**: Implement complete cleanup flow with both `beforeunload` and Tauri events.

```typescript
import { sseManager } from '@agent-manager/store/sse-manager';
import { opencodeClientManager } from '@agent-manager/api/opencode';
import { cleanupAgentManagerResources } from '@agent-manager/store/agent-manager-store';

let cleanupDone = false;

function cleanupResources() {
  if (cleanupDone) return;
  cleanupDone = true;
  
  cleanupAgentManagerResources();
  sseManager.disconnectAll();
  opencodeClientManager.disconnectAll();
}

window.addEventListener('beforeunload', cleanupResources);
listen('tauri://close-requested', cleanupResources);
```

**Acceptance Criteria**:
- Cleanup runs on window close
- Cleanup runs on page refresh
- Double cleanup is prevented
- Errors in one cleanup don't block others

---

### [ ] 4.2 Add Tauri event listener import and setup
**File**: `src/main.tsx`
**Lines**: At top of file

**Task**: Add `listen` and `UnlistenFn` imports from `@tauri-apps/api/event`.

```typescript
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
```

**Acceptance Criteria**:
- Import is added
- Type is used for cleanup function storage

---

### [ ] 4.3 Store and cleanup Tauri event listener
**File**: `src/main.tsx`

**Task**: Store the unlisten function and call it on cleanup.

```typescript
let unlistenClose: UnlistenFn | null = null;

listen('tauri://close-requested', () => {
  cleanupResources();
}).then((fn) => {
  unlistenClose = fn;
});

// In cleanupResources:
if (unlistenClose) {
  unlistenClose();
  unlistenClose = null;
}
```

**Acceptance Criteria**:
- Event listener is properly cleaned up
- No memory leak from event listeners

---

### [ ] 4.4 Add try/catch to prevent cleanup cascade failures
**File**: `src/main.tsx`

**Task**: Wrap each cleanup step in try/catch to ensure all cleanup runs.

```typescript
function cleanupResources() {
  if (cleanupDone) return;
  cleanupDone = true;
  
  try {
    cleanupAgentManagerResources();
  } catch (e) {
    console.error('[main] Agent manager cleanup error:', e);
  }
  
  try {
    sseManager.disconnectAll();
  } catch (e) {
    console.error('[main] SSE disconnect error:', e);
  }
  
  try {
    opencodeClientManager.disconnectAll();
  } catch (e) {
    console.error('[main] Client disconnect error:', e);
  }
}
```

**Acceptance Criteria**:
- One failing cleanup doesn't prevent others
- All errors are logged for debugging

---

## Phase 5: Testing

### [ ] 5.1 Add integration test for process cleanup
**File**: `src-tauri/src/tests/agent_manager/mod.rs` or new file

**Task**: Create test that:
1. Starts an OpenCode server
2. Stops it via `stop()`
3. Verifies process is reaped (no zombie)
4. Verifies no port leaks

```rust
#[test]
fn test_opencode_server_cleanup() {
    // Start server
    // Stop server
    // Check process is reaped
    // Check port is available
}
```

**Acceptance Criteria**:
- Test passes on CI
- Documents expected cleanup behavior

---

### [ ] 5.2 Add TypeScript test for SSE cleanup
**File**: `src/__tests__/lib/` or new test file

**Task**: Create test that:
1. Connects multiple SSE connections
2. Calls `disconnectAll()`
3. Verifies all connections are closed
4. Verifies Maps are empty

```typescript
describe('SSEManager', () => {
  it('disconnectAll closes all connections', () => {
    // Connect to multiple ports
    // Call disconnectAll
    // Verify all EventSources are closed
  });
});
```

**Acceptance Criteria**:
- Test passes
- Documents expected cleanup behavior

---

### [ ] 5.3 Add test for event handler replacement
**File**: `src/__tests__/lib/` or new test file

**Task**: Create test that:
1. Registers handler A
2. Registers handler B for same agent
3. Verifies only handler B is in Map
4. Verifies cleanup works correctly

```typescript
describe('OpenCodeClientManager', () => {
  it('registerEventHandler replaces existing handler', () => {
    // Register handler A
    // Register handler B
    // Verify only B is stored
    // Verify cleanup removes B
  });
});
```

**Acceptance Criteria**:
- Test passes
- Documents expected replacement behavior

---

### [ ] 5.4 Add manual testing checklist
**File**: `docs/TESTING.md` or add to this file

**Task**: Document manual tests to verify cleanup works in real scenarios.

```markdown
## Manual Testing Checklist

### Process Cleanup
- [ ] Start agent, verify process appears in Activity Monitor
- [ ] Stop agent, verify process disappears
- [ ] Force quit app, restart - no zombie processes

### SSE Cleanup
- [ ] Start multiple agents with active SSE
- [ ] Close app window
- [ ] Verify no hanging SSE connections (use `lsof -i` or Chrome DevTools)

### Event Handlers
- [ ] Rapidly restart same agent multiple times
- [ ] Verify no memory growth in DevTools Performance tab
```

**Acceptance Criteria**:
- Checklist is complete
- Can be used by QA or developers

---

## Phase 6: Documentation

### [ ] 6.1 Update AGENTS.md with cleanup commands
**File**: `AGENTS.md`

**Task**: Add information about cleanup to the agent guidelines.

```markdown
## Resource Cleanup

When implementing features that use:
- SSE connections: Use `sseManager.connect()` and ensure `sseManager.disconnect()` is called
- OpenCode servers: Use `commands.startAgentOpencode()` and `commands.stopAgentOpencode()`
- Module-level Maps: Clean up in `cleanupAgentManagerResources()` if adding new ones

See `plan.md` for full cleanup implementation details.
```

**Acceptance Criteria**:
- AGENTS.md is updated
- Future developers know cleanup requirements

---

### [ ] 6.2 Update module READMEs with cleanup patterns
**Files**:
- `src/modules/agent-manager/README.md`
- `src/modules/core/README.md`

**Task**: Document cleanup patterns in each module's README.

**Acceptance Criteria**:
- Each module documents its cleanup requirements
- Links to `plan.md` for full details

---

### [ ] 6.3 Add cleanup comments to key files
**Files**:
- `src/main.tsx`
- `src-tauri/src/agent_manager/opencode.rs`
- `src/modules/agent-manager/store/agent-manager-store.ts`

**Task**: Add comments explaining cleanup flow.

```typescript
// Cleanup is called from main.tsx on window close
// See plan.md Phase 4 for implementation details
```

**Acceptance Criteria**:
- Comments explain cleanup flow
- References to plan.md for details

---

## Implementation Order

1. **Phase 1**: Rust Backend Process Cleanup (1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7)
2. **Phase 2**: Event Handler Leak Fix (2.1 → 2.2)
3. **Phase 3**: Module-Level Map Cleanup (3.1 → 3.2 → 3.3 → 3.4)
4. **Phase 4**: React Shutdown Cleanup (4.1 → 4.2 → 4.3 → 4.4)
5. **Phase 5**: Testing (5.1 → 5.2 → 5.3 → 5.4)
6. **Phase 6**: Documentation (6.1 → 6.2 → 6.3)

---

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Rust Backend | 7 | 2-3 hours |
| Phase 2: Event Handler | 2 | 30 minutes |
| Phase 3: Module Maps | 4 | 1 hour |
| Phase 4: React Cleanup | 4 | 1 hour |
| Phase 5: Testing | 4 | 2 hours |
| Phase 6: Documentation | 3 | 1 hour |
| **Total** | **24** | **~8 hours** |

---

## Related Files

### Modified Files
- `src-tauri/src/agent_manager/opencode.rs`
- `src-tauri/src/agent_manager/commands.rs`
- `src/modules/agent-manager/store/agent-manager-store.ts`
- `src/modules/agent-manager/api/opencode.ts`
- `src/main.tsx`

### New Files
- `src/modules/core/components/orphaned-processes-dialog.tsx`
- `src-tauri/src/tests/agent_manager/process_cleanup_tests.rs`
- `src/__tests__/lib/cleanup-tests.ts`
- `docs/TESTING.md`

### Documentation Updates
- `AGENTS.md`
- `src/modules/agent-manager/README.md`
- `src/modules/core/README.md`
- `plan.md` (this file)

---

## References

- [Rust Child process documentation](https://doc.rust-lang.org/std/process/struct.Child.html)
- [Tauri window events](https://tauri.app/v1/api/js/classes/window/WindowManager)
- [React useEffect cleanup](https://react.dev/learn/synchronizing-with-effects)
- [Memory leak detection in Chrome DevTools](https://developer.chrome.com/docs/devtools/memory-problems/)
