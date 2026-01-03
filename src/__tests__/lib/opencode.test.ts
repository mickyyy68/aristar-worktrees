/**
 * Tests for OpenCode client (src/lib/opencode.ts)
 *
 * Tests the API client that communicates with the OpenCode server,
 * including SSE event subscription and message handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { opencodeClient } from '@/lib/opencode';
import { createMockSSEServer, MockSSEServer } from '../mocks/mock-sse-server';
import {
  messageUpdatedAssistant,
  messagePartUpdatedWithDelta,
  sessionStatusIdle,
  TEST_SESSION_ID,
} from '../mocks/opencode-events';

describe('OpenCodeClient', () => {
  let mockServer: MockSSEServer;

  beforeEach(async () => {
    mockServer = await createMockSSEServer();
  });

  afterEach(() => {
    if (mockServer?.isRunning()) {
      mockServer.stop();
    }
    opencodeClient.disconnect();
  });

  describe('connection', () => {
    it('should connect to server', () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);
      expect(opencodeClient.isConnected()).toBe(true);
    });

    it('should disconnect from server', () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);
      opencodeClient.disconnect();
      expect(opencodeClient.isConnected()).toBe(false);
    });

    it('should throw error when not connected', async () => {
      opencodeClient.disconnect();
      await expect(opencodeClient.healthCheck()).rejects.toThrow(
        'OpenCode client not connected'
      );
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const health = await opencodeClient.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.version).toBe('1.0.0');
    });
  });

  describe('waitForReady', () => {
    it('should return true when server is ready', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const isReady = await opencodeClient.waitForReady(3, 100);
      expect(isReady).toBe(true);
    });

    it('should return false when server is not available', async () => {
      // Connect to a port that doesn't exist
      opencodeClient.connect(59999);

      const isReady = await opencodeClient.waitForReady(2, 50);
      expect(isReady).toBe(false);
    });
  });

  describe('session management', () => {
    it('should create a new session', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const session = await opencodeClient.createSession('Test Session');
      expect(session.id).toBe('test-session-123');
      expect(session.title).toBe('Test Session');
    });

    it('should list sessions', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const sessions = await opencodeClient.listSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should set session ID', () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      opencodeClient.setSession(TEST_SESSION_ID);
      expect(opencodeClient.getSession()).toBe(TEST_SESSION_ID);
    });
  });

  describe('providers and agents', () => {
    it('should get providers', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const data = await opencodeClient.getProviders();
      expect(data.providers).toBeDefined();
      expect(data.providers.length).toBeGreaterThan(0);
      expect(data.providers[0].id).toBe('anthropic');
    });

    it('should get agents', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const agents = await opencodeClient.getAgents();
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].id).toBe('build');
    });
  });

  describe('sendPromptAsync', () => {
    it('should send prompt without waiting for response', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);
      await opencodeClient.createSession();

      // Should not throw
      await opencodeClient.sendPromptAsync('Test prompt');
    });

    it('should send prompt with model option', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);
      await opencodeClient.createSession();

      // Should not throw
      await opencodeClient.sendPromptAsync('Test prompt', {
        model: 'anthropic/claude-sonnet-4',
      });
    });

    it('should send prompt with agent option', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);
      await opencodeClient.createSession();

      // Should not throw
      await opencodeClient.sendPromptAsync('Test prompt', {
        agent: 'build',
      });
    });
  });

  describe('subscribeToEvents', () => {
    it('should subscribe to SSE events', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const events: unknown[] = [];
      const unsubscribe = opencodeClient.subscribeToEvents((event) => {
        events.push(event);
      });

      // Wait for server.connected event
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toEqual({ type: 'server.connected', properties: {} });

      unsubscribe();
    });

    it('should receive events sent by server', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const events: unknown[] = [];
      const unsubscribe = opencodeClient.subscribeToEvents((event) => {
        events.push(event);
      });

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send an event from the mock server
      mockServer.sendEvent(messageUpdatedAssistant);

      // Wait for event to arrive
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(1);
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual(messageUpdatedAssistant);

      unsubscribe();
    });

    it('should receive multiple events in sequence', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const events: unknown[] = [];
      const unsubscribe = opencodeClient.subscribeToEvents((event) => {
        events.push(event);
      });

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send multiple events
      mockServer.sendEvent(messageUpdatedAssistant);
      mockServer.sendEvent(messagePartUpdatedWithDelta);
      mockServer.sendEvent(sessionStatusIdle);

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have server.connected + 3 events
      expect(events.length).toBe(4);
      expect(events[1]).toEqual(messageUpdatedAssistant);
      expect(events[2]).toEqual(messagePartUpdatedWithDelta);
      expect(events[3]).toEqual(sessionStatusIdle);

      unsubscribe();
    });

    it('should stop receiving events after unsubscribe', async () => {
      const port = mockServer.getPort();
      opencodeClient.connect(port);

      const events: unknown[] = [];
      const unsubscribe = opencodeClient.subscribeToEvents((event) => {
        events.push(event);
      });

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      const countBefore = events.length;

      // Unsubscribe
      unsubscribe();

      // Send another event
      mockServer.sendEvent(messageUpdatedAssistant);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not receive new events after unsubscribe
      expect(events.length).toBe(countBefore);
    });
  });
});
