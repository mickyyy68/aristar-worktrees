/**
 * Message Store
 *
 * Dedicated Zustand store for messages with full parts support.
 * This is the source of truth for all message data across agents.
 *
 * Key features:
 * - Messages stored with full parts (text, tool invocations, reasoning)
 * - Streaming messages tracked separately from completed messages
 * - Loading states per agent
 * - Handles SSE events via imperative methods (not React hooks)
 * - Race condition handling for out-of-order SSE events
 *
 * ## SSE Event Handling
 *
 * OpenCode sends events that may arrive out of order:
 * - `message.part.updated` can arrive BEFORE `message.updated`
 * - Multiple messages may be sent in sequence (e.g., tool message then text response)
 *
 * This store handles these cases by:
 * 1. Buffering parts that arrive before their parent message (pendingParts)
 * 2. Using functional set() to avoid race conditions with rapid updates
 * 3. Completing existing messages before starting new ones
 */

import { create } from 'zustand';
import { logger } from '@core/lib';
import type {
  Message,
  StreamingMessage,
  MessagePart,
  APIPart,
  OpenCodeSSEEvent,
  MessageUpdatedEvent,
  MessagePartUpdatedEvent,
  SessionStatusEvent,
} from '../api/opencode-types';
import { convertAPIPart } from '../api/opencode-types';

// ============ State Interface ============

interface MessageState {
  /** Completed messages per agent: agentKey -> messages */
  messages: Record<string, Message[]>;

  /** Currently streaming message per agent: agentKey -> streaming message */
  streamingMessages: Record<string, StreamingMessage | null>;

  /** Loading indicator per agent: agentKey -> isLoading */
  loading: Record<string, boolean>;

  /**
   * Buffer for parts that arrive before their parent message.
   * This handles the race condition where message.part.updated arrives
   * before message.updated.
   * Key: messageId, Value: array of { part, delta } objects
   */
  pendingParts: Record<string, Array<{ part: APIPart; delta?: string }>>;
}

// ============ Actions Interface ============

interface MessageActions {
  /**
   * Handle a message.updated event - start a new message
   */
  startMessage(agentKey: string, messageId: string, role: 'user' | 'assistant' | 'system'): void;

  /**
   * Handle a message.part.updated event - update a part in the streaming message
   */
  updatePart(agentKey: string, messageId: string, part: APIPart, delta?: string): void;

  /**
   * Handle session.status=idle - complete the streaming message
   */
  completeMessage(agentKey: string): void;

  /**
   * Add a local user message (before sending to API)
   */
  addUserMessage(agentKey: string, content: string): void;

  /**
   * Load messages from API (for recovery)
   * Preserves full parts information
   */
  loadMessages(agentKey: string, messages: Message[]): void;

  /**
   * Clear all messages for an agent
   */
  clearMessages(agentKey: string): void;

  /**
   * Set loading state for an agent
   */
  setLoading(agentKey: string, loading: boolean): void;

  /**
   * Get all messages for an agent (completed + streaming)
   */
  getAllMessages(agentKey: string): Message[];

  /**
   * Handle an SSE event for a specific agent
   * This is the main entry point for processing events
   */
  handleSSEEvent(agentKey: string, event: OpenCodeSSEEvent): void;

  /**
   * Clean up all state for an agent
   */
  cleanupAgent(agentKey: string): void;
}

type MessageStore = MessageState & MessageActions;

// ============ Store Implementation ============

export const useMessageStore = create<MessageStore>()((set, get) => ({
  // Initial state
  messages: {},
  streamingMessages: {},
  loading: {},
  pendingParts: {},

  // ============ Actions ============

  startMessage(agentKey, messageId, role) {
    // Use functional set() to avoid race conditions with rapid updates
    set((state) => {
      const newMessage: StreamingMessage = {
        id: messageId,
        role,
        content: '',
        parts: [],
        timestamp: new Date(),
        isStreaming: true,
      };

      // Apply any buffered parts that arrived before this message.updated event
      const pendingKey = `${agentKey}:${messageId}`;
      const bufferedParts = state.pendingParts[pendingKey] || [];

      if (bufferedParts.length > 0) {
        void logger.debug(
          '[MessageStore]',
          `Applying ${bufferedParts.length} buffered parts for message ${messageId}`
        );
        for (const { part, delta } of bufferedParts) {
          applyPartToMessage(newMessage, part, delta);
        }
      }

      void logger.debug('[MessageStore]', `Started message ${messageId} for agent ${agentKey}`);

      return {
        streamingMessages: {
          ...state.streamingMessages,
          [agentKey]: newMessage,
        },
        loading: {
          ...state.loading,
          [agentKey]: true,
        },
        pendingParts: {
          ...state.pendingParts,
          [pendingKey]: undefined,
        } as Record<string, Array<{ part: APIPart; delta?: string }>>,
      };
    });
  },

  updatePart(agentKey, messageId, part, delta) {
    // Use functional set() to avoid race conditions with rapid part updates.
    // This ensures we always read the CURRENT state when applying updates,
    // preventing lost updates when multiple parts arrive in quick succession.
    set((state) => {
      const streaming = state.streamingMessages[agentKey];

      // If we don't have a streaming message yet, buffer this part.
      // This handles the case where message.part.updated arrives before message.updated.
      if (!streaming || streaming.id !== messageId) {
        const pendingKey = `${agentKey}:${messageId}`;
        const existing = state.pendingParts[pendingKey] || [];

        return {
          pendingParts: {
            ...state.pendingParts,
            [pendingKey]: [...existing, { part, delta }],
          },
        };
      }

      // Apply part to streaming message - create new object to ensure React re-render
      const updated: StreamingMessage = { ...streaming, parts: [...streaming.parts] };
      applyPartToMessage(updated, part, delta);

      return {
        streamingMessages: {
          ...state.streamingMessages,
          [agentKey]: updated,
        },
      };
    });
  },

  completeMessage(agentKey) {
    // Use functional set() to avoid race conditions
    set((state) => {
      const streaming = state.streamingMessages[agentKey];

      if (!streaming) {
        void logger.debug('[MessageStore]', `No streaming message to complete for ${agentKey}`);
        return {
          loading: {
            ...state.loading,
            [agentKey]: false,
          },
        };
      }

      // Convert streaming message to completed message
      const completedMessage: Message = {
        id: streaming.id,
        role: streaming.role,
        content: streaming.content,
        parts: streaming.parts,
        timestamp: streaming.timestamp,
        isStreaming: false,
      };

      // Add to completed messages
      const agentMessages = state.messages[agentKey] || [];

      void logger.debug(
        '[MessageStore]',
        `Completed message ${streaming.id} for ${agentKey}, parts: ${streaming.parts.length}, content length: ${streaming.content.length}`
      );

      return {
        messages: {
          ...state.messages,
          [agentKey]: [...agentMessages, completedMessage],
        },
        streamingMessages: {
          ...state.streamingMessages,
          [agentKey]: null,
        },
        loading: {
          ...state.loading,
          [agentKey]: false,
        },
      };
    });
  },

  addUserMessage(agentKey, content) {
    const state = get();
    const agentMessages = state.messages[agentKey] || [];

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      parts: [{ type: 'text', text: content }],
      timestamp: new Date(),
      isStreaming: false,
    };

    set({
      messages: {
        ...state.messages,
        [agentKey]: [...agentMessages, userMessage],
      },
    });

    void logger.debug('[MessageStore]', `Added user message for ${agentKey}`);
  },

  loadMessages(agentKey, messages) {
    set((state) => ({
      messages: {
        ...state.messages,
        [agentKey]: messages,
      },
      // Clear streaming state when loading from API
      streamingMessages: {
        ...state.streamingMessages,
        [agentKey]: null,
      },
      loading: {
        ...state.loading,
        [agentKey]: false,
      },
    }));

    void logger.debug('[MessageStore]', `Loaded ${messages.length} messages for ${agentKey}`);
  },

  clearMessages(agentKey) {
    set((state) => ({
      messages: {
        ...state.messages,
        [agentKey]: [],
      },
      streamingMessages: {
        ...state.streamingMessages,
        [agentKey]: null,
      },
      loading: {
        ...state.loading,
        [agentKey]: false,
      },
    }));

    void logger.debug('[MessageStore]', `Cleared messages for ${agentKey}`);
  },

  setLoading(agentKey, loading) {
    set((state) => ({
      loading: {
        ...state.loading,
        [agentKey]: loading,
      },
    }));
  },

  getAllMessages(agentKey) {
    const state = get();
    const completed = state.messages[agentKey] || [];
    const streaming = state.streamingMessages[agentKey];

    if (streaming) {
      return [...completed, streaming];
    }
    return completed;
  },

  handleSSEEvent(agentKey, event) {
    const store = get();

    switch (event.type) {
      case 'message.updated': {
        const e = event as MessageUpdatedEvent;
        const { info } = e.properties;

        // Skip user messages - we add them locally
        if (info.role === 'user') {
          return;
        }

        // Check if we already have a streaming message for this exact message ID
        const existingStreaming = store.streamingMessages[agentKey];

        if (existingStreaming?.id === info.id) {
          // Same message ID - duplicate event, ignore it
          return;
        }

        if (existingStreaming) {
          // A NEW message is starting while we have an existing streaming message.
          // This happens when OpenCode sends multiple messages (e.g., tool message then text response).
          // Complete the current streaming message first before starting the new one.
          store.completeMessage(agentKey);
        }

        // Start the new streaming message
        store.startMessage(agentKey, info.id, info.role);
        break;
      }

      case 'message.part.updated': {
        const e = event as MessagePartUpdatedEvent;
        const { part, delta } = e.properties;
        // messageID is inside part, not at top level
        const messageID = (part as { messageID?: string }).messageID;
        if (messageID) {
          store.updatePart(agentKey, messageID, part, delta);
        } else {
          void logger.warn('[MessageStore]', 'message.part.updated missing messageID');
        }
        break;
      }

      case 'session.status': {
        const e = event as SessionStatusEvent;
        const { status } = e.properties;
        const statusType = typeof status === 'object' ? status.type : status;

        if (statusType === 'busy' || statusType === 'running' || statusType === 'pending') {
          store.setLoading(agentKey, true);
        } else if (statusType === 'idle') {
          store.completeMessage(agentKey);
        }
        break;
      }

      case 'session.idle': {
        store.completeMessage(agentKey);
        break;
      }

      // Ignore heartbeat, server.connected, and unknown events
      default:
        break;
    }
  },

  cleanupAgent(agentKey) {
    set((state) => {
      const { [agentKey]: _msgs, ...remainingMessages } = state.messages;
      const { [agentKey]: _streaming, ...remainingStreaming } = state.streamingMessages;
      const { [agentKey]: _loading, ...remainingLoading } = state.loading;

      // Clean up pending parts for this agent
      const remainingPending: Record<string, Array<{ part: APIPart; delta?: string }>> = {};
      for (const key of Object.keys(state.pendingParts)) {
        if (!key.startsWith(`${agentKey}:`)) {
          remainingPending[key] = state.pendingParts[key];
        }
      }

      return {
        messages: remainingMessages,
        streamingMessages: remainingStreaming,
        loading: remainingLoading,
        pendingParts: remainingPending,
      };
    });

    void logger.debug('[MessageStore]', `Cleaned up agent ${agentKey}`);
  },
}));

// ============ Helper Functions ============

/**
 * Apply a part update to a streaming message
 */
function applyPartToMessage(
  message: StreamingMessage,
  part: APIPart,
  delta?: string
): void {
  // Check for metadata part types first (before type narrowing)
  const partType = (part as { type: string }).type;
  if (partType === 'step-start' || partType === 'step-finish') {
    // Metadata events - ignore for message display
    return;
  }

  if (part.type === 'text') {
    // Handle text delta - accumulate content
    if (delta && typeof delta === 'string') {
      message.content += delta;
    } else if (part.text) {
      // Full text update (non-delta) - rare but handle it
      message.content = part.text;
    }

    // Update or add text part
    const existingTextIdx = message.parts.findIndex((p) => p.type === 'text');
    if (existingTextIdx >= 0) {
      message.parts[existingTextIdx] = { type: 'text', text: message.content };
    } else {
      message.parts.push({ type: 'text', text: message.content });
    }
  } else if (part.type === 'tool') {
    // Convert API tool part to internal format
    const toolPart: MessagePart = convertAPIPart(part);

    // Find existing tool part by callID to update it, or add new
    const existingIdx = message.parts.findIndex(
      (p) =>
        p.type === 'tool-invocation' &&
        (p as { toolInvocationId?: string }).toolInvocationId === part.callID
    );

    if (existingIdx >= 0) {
      message.parts[existingIdx] = toolPart;
    } else {
      message.parts.push(toolPart);
    }
  } else if (part.type === 'reasoning') {
    // Convert API reasoning part to internal format
    const reasoningPart: MessagePart = convertAPIPart(part);

    // Find or add reasoning part
    const existingIdx = message.parts.findIndex((p) => p.type === 'reasoning');
    if (existingIdx >= 0) {
      // Accumulate reasoning text
      const existing = message.parts[existingIdx] as { type: 'reasoning'; text: string };
      if (delta) {
        existing.text += delta;
      } else {
        message.parts[existingIdx] = reasoningPart;
      }
    } else {
      message.parts.push(reasoningPart);
    }
  } else {
    // Unknown part type - ignore silently (step-start/step-finish are already filtered above)
  }
}

// ============ Selector Hooks ============

/**
 * Get messages for a specific agent
 */
export function getAgentMessages(agentKey: string | null): Message[] {
  if (!agentKey) return [];
  return useMessageStore.getState().getAllMessages(agentKey);
}

/**
 * Check if an agent is currently loading
 */
export function isAgentLoading(agentKey: string | null): boolean {
  if (!agentKey) return false;
  return useMessageStore.getState().loading[agentKey] ?? false;
}
