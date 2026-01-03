/**
 * Test setup file for Bun tests
 * This file is preloaded before all tests run
 */

import { EventSource as EventSourcePolyfill } from 'eventsource';

// Add EventSource polyfill (not available in Bun runtime by default)
globalThis.EventSource = EventSourcePolyfill as unknown as typeof EventSource;

// Mock Tauri APIs that are used in the codebase
// @ts-expect-error - Mocking Tauri invoke
globalThis.__TAURI_INTERNALS__ = {
  invoke: async () => ({}),
  transformCallback: () => 0,
};

// Suppress console.log in tests unless DEBUG is set
if (!process.env.DEBUG) {
  const originalConsole = { ...console };
  globalThis.console = {
    ...originalConsole,
    log: () => {},
    debug: () => {},
    // Keep error and warn for debugging test failures
    error: originalConsole.error,
    warn: originalConsole.warn,
  };
}
