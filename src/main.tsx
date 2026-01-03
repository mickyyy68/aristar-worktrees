import { createRoot } from 'react-dom/client';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import App from './App';
import './index.css';
import { sseManager } from '@agent-manager/store/sse-manager';
import { opencodeClientManager } from '@agent-manager/api/opencode';
import { cleanupAgentManagerResources } from '@agent-manager/store/agent-manager-store';

/**
 * Resource cleanup for app shutdown.
 * 
 * This function handles cleanup of:
 * 1. Agent manager module-level Maps (SSE subscriptions, recovery tracking)
 * 2. SSE connections to OpenCode servers
 * 3. OpenCode client connections
 * 
 * Each cleanup step is wrapped in try/catch to ensure one failing
 * cleanup doesn't prevent others from running.
 * 
 * @see plan.md Phase 4 for implementation details
 */
let cleanupDone = false;

function cleanupResources(): void {
  if (cleanupDone) {
    console.log('[main] Cleanup already performed, skipping');
    return;
  }
  cleanupDone = true;
  console.log('[main] Starting resource cleanup...');

  // 1. Clean up agent manager module-level resources
  try {
    cleanupAgentManagerResources();
  } catch (e) {
    console.error('[main] Agent manager cleanup error:', e);
  }

  // 2. Disconnect all SSE connections
  try {
    sseManager.disconnectAll();
    console.log('[main] SSE connections disconnected');
  } catch (e) {
    console.error('[main] SSE disconnect error:', e);
  }

  // 3. Disconnect all OpenCode clients
  try {
    opencodeClientManager.disconnectAll();
    console.log('[main] OpenCode clients disconnected');
  } catch (e) {
    console.error('[main] Client disconnect error:', e);
  }

  console.log('[main] Resource cleanup complete');
}

// Register cleanup handlers
window.addEventListener('beforeunload', cleanupResources);

// Also listen for Tauri close event
let unlistenClose: UnlistenFn | null = null;
listen('tauri://close-requested', () => {
  cleanupResources();
}).then((fn) => {
  unlistenClose = fn;
}).catch((e) => {
  console.error('[main] Failed to register close listener:', e);
});

// Clean up the listener when the window unloads
window.addEventListener('unload', () => {
  if (unlistenClose) {
    unlistenClose();
    unlistenClose = null;
  }
});

createRoot(document.getElementById('root')!).render(<App />);
