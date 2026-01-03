/**
 * SSE Manager
 *
 * Manages SSE connections per OpenCode server port (not per agent).
 * This centralized approach prevents multiple SSE connections to the same server
 * and ensures proper event dispatching to all registered handlers.
 */

import type { SSEEvent } from '../api/opencode-types';
import { extractSessionId } from '../api/opencode-types';
import { logger } from '@core/lib';

/**
 * Handler function for SSE events
 */
type SSEEventHandler = (event: SSEEvent) => void;

/**
 * Connection state for a single port
 */
interface PortConnection {
  eventSource: EventSource;
  /** Map of sessionId -> Set of handlers */
  handlers: Map<string, Set<SSEEventHandler>>;
  /** Whether the connection is established (server.connected received) */
  isConnected: boolean;
}

/**
 * Centralized SSE Manager
 * Manages one SSE connection per OpenCode server port
 */
class SSEManager {
  private connections = new Map<number, PortConnection>();
  private pendingConnections = new Map<number, Promise<void>>();

  /**
   * Connect to an OpenCode server's SSE endpoint
   * Returns a promise that resolves when the connection is established (server.connected received)
   * If already connected, returns immediately
   */
  async connect(port: number): Promise<void> {
    // Already connected
    const existing = this.connections.get(port);
    if (existing?.isConnected) {
      await logger.debug('[SSEManager]', `Port ${port} already connected`);
      return;
    }

    // Connection in progress - wait for it
    const pending = this.pendingConnections.get(port);
    if (pending) {
      await logger.debug('[SSEManager]', `Port ${port} connection in progress, waiting...`);
      return pending;
    }

    // Start new connection
    const connectionPromise = this.establishConnection(port);
    this.pendingConnections.set(port, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      this.pendingConnections.delete(port);
    }
  }

  /**
   * Internal method to establish SSE connection
   */
  private establishConnection(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `http://127.0.0.1:${port}/event`;
      void logger.debug('[SSEManager]', `Connecting to ${url}`);

      const eventSource = new EventSource(url);

      const connection: PortConnection = {
        eventSource,
        handlers: new Map(),
        isConnected: false,
      };

      // Timeout for connection
      const timeout = setTimeout(() => {
        if (!connection.isConnected) {
          eventSource.close();
          this.connections.delete(port);
          reject(new Error(`SSE connection timeout for port ${port}`));
        }
      }, 10000);

      eventSource.onmessage = (e) => {
        try {
          const event: SSEEvent = JSON.parse(e.data);
          
          // Log all events for debugging - include raw properties for part.updated
          if (event.type === 'message.part.updated') {
            console.log('[SSE-DEBUG] message.part.updated raw props:', JSON.stringify(event.properties));
          } else {
            console.log('[SSE-DEBUG] Event received:', event.type, extractSessionId(event) || 'no-session');
          }

          if (event.type === 'server.connected') {
            connection.isConnected = true;
            this.connections.set(port, connection);
            clearTimeout(timeout);
            logger.debug('[SSEManager]', `Port ${port} connected`);
            resolve();
            return;
          }

          // Dispatch event to registered handlers
          this.dispatchEvent(port, event);
        } catch (err) {
          logger.error('[SSEManager]', 'Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = (err) => {
        logger.error('[SSEManager]', `SSE error for port ${port}:`, err);

        if (!connection.isConnected) {
          clearTimeout(timeout);
          this.connections.delete(port);
          reject(new Error(`SSE connection failed for port ${port}`));
        } else {
          // Connection was established but then failed
          // EventSource will auto-reconnect
          logger.warn('[SSEManager]', `SSE connection lost for port ${port}, will auto-reconnect`);
        }
      };

      // Store connection even before connected (for cleanup)
      this.connections.set(port, connection);
    });
  }

  /**
   * Check if a port has an active SSE connection
   */
  isConnected(port: number): boolean {
    return this.connections.get(port)?.isConnected ?? false;
  }

  /**
   * Register a handler for a specific session's events
   * Returns an unsubscribe function
   *
   * @param port - The server port
   * @param sessionId - The session ID to filter events for (use '*' for all events)
   * @param handler - The event handler function
   */
  subscribe(port: number, sessionId: string, handler: SSEEventHandler): () => void {
    const connection = this.connections.get(port);
    if (!connection) {
      throw new Error(`No SSE connection on port ${port}. Call connect() first.`);
    }

    // Get or create handler set for this session
    let handlers = connection.handlers.get(sessionId);
    if (!handlers) {
      handlers = new Set();
      connection.handlers.set(sessionId, handlers);
    }

    handlers.add(handler);
    logger.debug('[SSEManager]', `Handler registered for session ${sessionId} on port ${port}`);

    // Return unsubscribe function
    return () => {
      handlers?.delete(handler);
      if (handlers?.size === 0) {
        connection.handlers.delete(sessionId);
      }
      logger.debug('[SSEManager]', `Handler unregistered for session ${sessionId} on port ${port}`);
    };
  }

  /**
   * Dispatch an event to all registered handlers
   */
  private dispatchEvent(port: number, event: SSEEvent): void {
    const connection = this.connections.get(port);
    if (!connection) return;

    // Extract session ID from event
    const sessionId = extractSessionId(event);
    
    // Debug: log registered handlers
    const registeredSessions = Array.from(connection.handlers.keys());
    console.log('[SSE-DEBUG] Dispatching', event.type, 'sessionId:', sessionId, 'registered sessions:', registeredSessions);

    // Dispatch to specific session handlers
    if (sessionId) {
      const handlers = connection.handlers.get(sessionId);
      console.log('[SSE-DEBUG] Found', handlers?.size || 0, 'handlers for session', sessionId);
      handlers?.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          logger.error('[SSEManager]', 'Handler error:', err);
        }
      });
    }

    // Also dispatch to wildcard handlers (for debugging or global listeners)
    const wildcardHandlers = connection.handlers.get('*');
    wildcardHandlers?.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        logger.error('[SSEManager]', 'Wildcard handler error:', err);
      }
    });
  }

  /**
   * Disconnect from a port and clean up all handlers
   */
  disconnect(port: number): void {
    const connection = this.connections.get(port);
    if (connection) {
      connection.eventSource.close();
      connection.handlers.clear();
      this.connections.delete(port);
      logger.debug('[SSEManager]', `Port ${port} disconnected`);
    }
  }

  /**
   * Unsubscribe all handlers for a specific session
   */
  unsubscribeSession(port: number, sessionId: string): void {
    const connection = this.connections.get(port);
    if (connection) {
      connection.handlers.delete(sessionId);
      logger.debug('[SSEManager]', `All handlers removed for session ${sessionId} on port ${port}`);
    }
  }

  /**
   * Get statistics about current connections
   */
  getStats(): { ports: number[]; handlerCounts: Record<number, number> } {
    const ports = Array.from(this.connections.keys());
    const handlerCounts: Record<number, number> = {};

    for (const [port, connection] of this.connections) {
      let count = 0;
      for (const handlers of connection.handlers.values()) {
        count += handlers.size;
      }
      handlerCounts[port] = count;
    }

    return { ports, handlerCounts };
  }

  /**
   * Disconnect all ports
   */
  disconnectAll(): void {
    for (const port of this.connections.keys()) {
      this.disconnect(port);
    }
  }
}

/**
 * Global SSE Manager instance
 * Use this singleton to manage all SSE connections
 */
export const sseManager = new SSEManager();
