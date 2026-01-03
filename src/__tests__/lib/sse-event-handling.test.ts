/**
 * Tests for SSE Event Handling
 *
 * These tests verify that SSE events from OpenCode are correctly processed
 * and result in proper state updates in the agent manager store.
 *
 * Key event types tested:
 * - message.updated (not message.created)
 * - message.part.updated with delta field
 * - session.status with {type: "idle"} object
 * - session.idle
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { useAgentManagerStore } from '@/store/agent-manager-store';
import { opencodeClient } from '@/lib/opencode';
import type { OpenCodeMessage } from '@/lib/opencode';
import { createMockSSEServer, type MockSSEServer } from '../mocks/mock-sse-server';
import {
  TEST_SESSION_ID,
  TEST_MESSAGE_ID,
  TEST_AGENT_ID,
  messageUpdatedAssistant,
  messageUpdatedUser,
  messagePartUpdatedWithDelta,
  messagePartUpdatedWithDelta2,
  messagePartUpdatedFullText,
  sessionStatusIdle,
  sessionStatusRunning,
  sessionIdleEvent,
  legacyMessageCreated,
  legacyMessageCompleted,
  eventWithDifferentSession,
  createStreamingSequence,
} from '../mocks/opencode-events';

// Extended message type for testing
interface TestMessage extends OpenCodeMessage {
  parts?: unknown[];
  isStreaming?: boolean;
}

/**
 * Helper to simulate the handleEvent function behavior from use-agent-sse.ts
 * This is extracted logic for testing without React hooks
 */
function createEventHandler(agentId: string, sessionId: string) {
  let streamingMessageRef: {
    id: string;
    content: string;
    isStreaming: boolean;
  } | null = null;

  const updateMessages = (
    agentId: string,
    updater: (messages: OpenCodeMessage[]) => OpenCodeMessage[]
  ) => {
    useAgentManagerStore.setState((state) => ({
      agentMessages: {
        ...state.agentMessages,
        [agentId]: updater(state.agentMessages[agentId] || []),
      },
    }));
  };

  const setAgentLoading = (agentId: string, loading: boolean) => {
    useAgentManagerStore.setState((state) => ({
      agentLoading: {
        ...state.agentLoading,
        [agentId]: loading,
      },
    }));
  };

  return function handleEvent(event: { type: string; properties?: Record<string, unknown> }) {
    if (!agentId || !sessionId) return;

    const props = event.properties as Record<string, unknown>;
    const eventSessionId = (props?.sessionID as string) || (props?.info as { id?: string })?.id;

    // Filter events by session ID (but allow events without session ID)
    if (eventSessionId && eventSessionId !== sessionId) {
      return;
    }

    switch (event.type) {
      case 'message.updated': {
        const info = props?.info as {
          id: string;
          role: string;
          time?: { created: string };
        };
        if (!info) return;
        if (info.role === 'user') return;

        const existingMessages = useAgentManagerStore.getState().agentMessages[agentId] || [];
        const existingMessage = existingMessages.find((m) => m.id === info.id);

        if (!existingMessage) {
          const newMessage: TestMessage = {
            id: info.id,
            role: info.role as 'assistant',
            content: '',
            timestamp: new Date(info.time?.created || Date.now()),
            parts: [],
            isStreaming: true,
          };
          streamingMessageRef = { id: info.id, content: '', isStreaming: true };

          updateMessages(agentId, (messages) => [...messages, newMessage]);
          setAgentLoading(agentId, true);
        }
        break;
      }

      case 'message.part.updated': {
        const part = props?.part as { type: string; messageID?: string; text?: string };
        const delta = props?.delta as string | undefined;

        if (!part) return;

        // Create message if needed
        if (!streamingMessageRef && part.messageID) {
          const existingMessages = useAgentManagerStore.getState().agentMessages[agentId] || [];
          const existingMessage = existingMessages.find((m) => m.id === part.messageID);
          if (existingMessage) {
            streamingMessageRef = {
              id: existingMessage.id,
              content: existingMessage.content || '',
              isStreaming: true,
            };
          } else {
            const newMessage: TestMessage = {
              id: part.messageID,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              parts: [],
              isStreaming: true,
            };
            streamingMessageRef = { id: part.messageID, content: '', isStreaming: true };
            updateMessages(agentId, (messages) => [...messages, newMessage]);
            setAgentLoading(agentId, true);
          }
        }

        if (!streamingMessageRef) return;

        if (part.messageID && streamingMessageRef.id !== part.messageID) return;

        // Handle delta or full text
        if (delta && typeof delta === 'string') {
          streamingMessageRef.content += delta;
        } else if (part.type === 'text' && part.text) {
          streamingMessageRef.content = part.text;
        }

        const currentContent = streamingMessageRef.content;
        const currentId = streamingMessageRef.id;
        updateMessages(agentId, (messages) =>
          messages.map((m) => (m.id === currentId ? { ...m, content: currentContent } : m))
        );
        break;
      }

      case 'session.status': {
        const status = props?.status as { type?: string } | string;
        if (!status) return;

        const statusType = typeof status === 'object' ? status.type : status;

        if (statusType === 'busy' || statusType === 'running' || statusType === 'pending') {
          setAgentLoading(agentId, true);
        } else if (statusType === 'idle') {
          if (streamingMessageRef) {
            streamingMessageRef.isStreaming = false;
            const currentId = streamingMessageRef.id;
            updateMessages(agentId, (messages) =>
              messages.map((m) => (m.id === currentId ? { ...m, isStreaming: false } : m))
            );
            streamingMessageRef = null;
          }
          setAgentLoading(agentId, false);
        }
        break;
      }

      case 'session.idle': {
        if (streamingMessageRef) {
          streamingMessageRef.isStreaming = false;
          const currentId = streamingMessageRef.id;
          updateMessages(agentId, (messages) =>
            messages.map((m) => (m.id === currentId ? { ...m, isStreaming: false } : m))
          );
          streamingMessageRef = null;
        }
        setAgentLoading(agentId, false);
        break;
      }

      // Legacy events
      case 'message.created': {
        const info = props?.info as { id: string; role: string; created: string };
        if (!info || info.role === 'user') return;

        const newMessage: TestMessage = {
          id: info.id,
          role: info.role as 'assistant',
          content: '',
          timestamp: new Date(info.created),
          parts: [],
          isStreaming: true,
        };
        streamingMessageRef = { id: info.id, content: '', isStreaming: true };
        updateMessages(agentId, (messages) => [...messages, newMessage]);
        setAgentLoading(agentId, true);
        break;
      }

      case 'message.completed': {
        const messageID = props?.messageID as string;
        if (streamingMessageRef && streamingMessageRef.id === messageID) {
          streamingMessageRef.isStreaming = false;
          const currentId = streamingMessageRef.id;
          updateMessages(agentId, (messages) =>
            messages.map((m) => (m.id === currentId ? { ...m, isStreaming: false } : m))
          );
          streamingMessageRef = null;
        }
        setAgentLoading(agentId, false);
        break;
      }
    }
  };
}

describe('SSE Event Handling', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAgentManagerStore.setState({
      agentMessages: {},
      agentLoading: {},
    });
  });

  describe('message.updated event', () => {
    it('should create new message for assistant role', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(messageUpdatedAssistant);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe(TEST_MESSAGE_ID);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('');
    });

    it('should ignore user messages', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(messageUpdatedUser);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(0);
    });

    it('should set loading state when message is created', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(messageUpdatedAssistant);

      const loading = useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID];
      expect(loading).toBe(true);
    });

    it('should not create duplicate messages', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      // Send same event twice
      handleEvent(messageUpdatedAssistant);
      handleEvent(messageUpdatedAssistant);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(1);
    });
  });

  describe('message.part.updated event', () => {
    it('should accumulate delta text', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      // Create message first
      handleEvent(messageUpdatedAssistant);

      // Send deltas
      handleEvent(messagePartUpdatedWithDelta);
      handleEvent(messagePartUpdatedWithDelta2);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages[0].content).toBe('Hello, world!');
    });

    it('should handle full text update (non-delta)', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      // Create message first
      handleEvent(messageUpdatedAssistant);

      // Send full text
      handleEvent(messagePartUpdatedFullText);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages[0].content).toBe('This is the complete text.');
    });

    it('should create message lazily if not exists', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      // Send part without prior message.updated
      handleEvent(messagePartUpdatedWithDelta);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe(TEST_MESSAGE_ID);
      expect(messages[0].content).toBe('Hello, ');
    });
  });

  describe('session.status event', () => {
    it('should handle idle status as object {type: "idle"}', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      // Create and update message
      handleEvent(messageUpdatedAssistant);
      handleEvent(messagePartUpdatedWithDelta);

      // Set running first
      handleEvent(sessionStatusRunning);
      expect(useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID]).toBe(true);

      // Then idle
      handleEvent(sessionStatusIdle);

      expect(useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID]).toBe(false);
    });

    it('should set loading true for running/busy/pending', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(sessionStatusRunning);
      expect(useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID]).toBe(true);
    });

    it('should mark message as not streaming when idle', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(messageUpdatedAssistant);
      handleEvent(messagePartUpdatedWithDelta);
      handleEvent(sessionStatusIdle);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect((messages[0] as { isStreaming?: boolean }).isStreaming).toBe(false);
    });
  });

  describe('session.idle event', () => {
    it('should clear loading state', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(messageUpdatedAssistant);
      handleEvent(sessionIdleEvent);

      expect(useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID]).toBe(false);
    });

    it('should mark streaming as complete', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(messageUpdatedAssistant);
      handleEvent(messagePartUpdatedWithDelta);
      handleEvent(sessionIdleEvent);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect((messages[0] as { isStreaming?: boolean }).isStreaming).toBe(false);
    });
  });

  describe('session ID filtering', () => {
    it('should ignore events with different session ID', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(eventWithDifferentSession);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(0);
    });
  });

  describe('legacy events', () => {
    it('should handle legacy message.created event', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(legacyMessageCreated);

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('legacy-msg-001');
    });

    it('should handle legacy message.completed event', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      handleEvent(legacyMessageCreated);
      handleEvent(legacyMessageCompleted);

      expect(useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID]).toBe(false);
    });
  });

  describe('complete streaming sequence', () => {
    it('should correctly process a full streaming message', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);
      const events = createStreamingSequence(
        TEST_SESSION_ID,
        'msg-sequence-001',
        ['I am ', 'an AI ', 'assistant.']
      );

      for (const event of events) {
        handleEvent(event);
      }

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('I am an AI assistant.');
      expect((messages[0] as { isStreaming?: boolean }).isStreaming).toBe(false);
      expect(useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID]).toBe(false);
    });

    it('should handle multiple messages in sequence', () => {
      const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

      // First message
      const events1 = createStreamingSequence(TEST_SESSION_ID, 'msg-001', ['First message']);
      for (const event of events1) {
        handleEvent(event);
      }

      // Second message
      const events2 = createStreamingSequence(TEST_SESSION_ID, 'msg-002', ['Second message']);
      for (const event of events2) {
        handleEvent(event);
      }

      const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
    });
  });
});

describe('SSE Integration with Mock Server', () => {
  let mockServer: MockSSEServer;

  beforeEach(async () => {
    mockServer = await createMockSSEServer();
    useAgentManagerStore.setState({
      agentMessages: {},
      agentLoading: {},
    });
  });

  afterEach(() => {
    if (mockServer?.isRunning()) {
      mockServer.stop();
    }
    opencodeClient.disconnect();
  });

  it('should receive and process events from SSE server', async () => {
    const port = mockServer.getPort();
    opencodeClient.connect(port);

    const receivedEvents: unknown[] = [];
    const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);

    const unsubscribe = opencodeClient.subscribeToEvents((event) => {
      receivedEvents.push(event);
      handleEvent(event);
    });

    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send streaming events
    mockServer.sendEvent(messageUpdatedAssistant);
    mockServer.sendEvent(messagePartUpdatedWithDelta);
    mockServer.sendEvent(messagePartUpdatedWithDelta2);
    mockServer.sendEvent(sessionStatusIdle);

    // Wait for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify events received
    expect(receivedEvents.length).toBeGreaterThanOrEqual(4);

    // Verify store was updated
    const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('Hello, world!');
    expect(useAgentManagerStore.getState().agentLoading[TEST_AGENT_ID]).toBe(false);

    unsubscribe();
  });

  it('should handle multiple rapid events', async () => {
    const port = mockServer.getPort();
    opencodeClient.connect(port);

    const handleEvent = createEventHandler(TEST_AGENT_ID, TEST_SESSION_ID);
    const unsubscribe = opencodeClient.subscribeToEvents(handleEvent);

    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send many deltas rapidly
    mockServer.sendEvent(messageUpdatedAssistant);
    for (let i = 0; i < 10; i++) {
      mockServer.sendEvent({
        type: 'message.part.updated',
        properties: {
          sessionID: TEST_SESSION_ID,
          part: { type: 'text', messageID: TEST_MESSAGE_ID },
          delta: `chunk${i} `,
        },
      });
    }
    mockServer.sendEvent(sessionStatusIdle);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    const messages = useAgentManagerStore.getState().agentMessages[TEST_AGENT_ID] || [];
    expect(messages[0].content).toBe('chunk0 chunk1 chunk2 chunk3 chunk4 chunk5 chunk6 chunk7 chunk8 chunk9 ');

    unsubscribe();
  });
});
