import { useEffect, useRef, useCallback } from 'react';
import { useAgentManagerStore } from '@/store/agent-manager-store';
import { opencodeClient } from '@/lib/opencode';
import type { OpenCodeMessage } from '@/lib/opencode';
import type { MessagePart } from '@/store/types';

/**
 * SSE Event types from OpenCode
 */
interface SSEEvent {
  type: string;
  properties?: Record<string, unknown>;
}

interface MessageCreatedEvent extends SSEEvent {
  type: 'message.created';
  properties: {
    sessionID: string;
    info: {
      id: string;
      role: 'user' | 'assistant' | 'system';
      created: string;
    };
  };
}

interface MessagePartDeltaEvent extends SSEEvent {
  type: 'message.part.delta';
  properties: {
    sessionID: string;
    messageID: string;
    part: MessagePart;
  };
}

interface MessageCompletedEvent extends SSEEvent {
  type: 'message.completed';
  properties: {
    sessionID: string;
    messageID: string;
  };
}

interface SessionUpdatedEvent extends SSEEvent {
  type: 'session.updated';
  properties: {
    info: {
      id: string;
      status?: string;
    };
  };
}

/**
 * Extended message with streaming support
 */
export interface StreamingMessage extends OpenCodeMessage {
  parts: MessagePart[];
  isStreaming: boolean;
}

/**
 * Hook to subscribe to SSE events for a specific agent
 * Handles real-time message streaming updates
 */
export function useAgentSSE(agentId: string | null, port: number | null, sessionId: string | null) {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const streamingMessageRef = useRef<StreamingMessage | null>(null);

  const {
    agentMessages,
    agentLoading,
  } = useAgentManagerStore();

  // Helper to update agent messages in the store
  const updateMessages = useCallback((agentId: string, updater: (messages: OpenCodeMessage[]) => OpenCodeMessage[]) => {
    useAgentManagerStore.setState((state) => ({
      agentMessages: {
        ...state.agentMessages,
        [agentId]: updater(state.agentMessages[agentId] || []),
      },
    }));
  }, []);

  // Helper to set agent loading state
  const setAgentLoading = useCallback((agentId: string, loading: boolean) => {
    useAgentManagerStore.setState((state) => ({
      agentLoading: {
        ...state.agentLoading,
        [agentId]: loading,
      },
    }));
  }, []);

  // Handle SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    if (!agentId || !sessionId) return;

    console.log('[SSE] Event:', event.type, event.properties);

    switch (event.type) {
      case 'message.created': {
        const e = event as MessageCreatedEvent;
        if (e.properties.sessionID !== sessionId) return;
        if (e.properties.info.role === 'user') return; // We add user messages manually

        // Create new streaming message
        const newMessage: StreamingMessage = {
          id: e.properties.info.id,
          role: e.properties.info.role,
          content: '',
          timestamp: new Date(e.properties.info.created),
          parts: [],
          isStreaming: true,
        };
        streamingMessageRef.current = newMessage;

        // Add to messages
        updateMessages(agentId, (messages) => [...messages, newMessage as OpenCodeMessage]);
        setAgentLoading(agentId, true);
        break;
      }

      case 'message.part.delta': {
        const e = event as MessagePartDeltaEvent;
        if (e.properties.sessionID !== sessionId) return;
        if (!streamingMessageRef.current) return;
        if (streamingMessageRef.current.id !== e.properties.messageID) return;

        const part = e.properties.part;
        
        // Handle text parts - accumulate content
        if (part.type === 'text' && 'text' in part) {
          streamingMessageRef.current.content += (part as { type: 'text'; text: string }).text;
        }
        
        // Add part to parts array
        streamingMessageRef.current.parts.push(part);

        // Update message in store
        const currentMessage = streamingMessageRef.current;
        updateMessages(agentId, (messages) =>
          messages.map((m) =>
            m.id === currentMessage.id
              ? { ...m, content: currentMessage.content, parts: [...currentMessage.parts] }
              : m
          )
        );
        break;
      }

      case 'message.completed': {
        const e = event as MessageCompletedEvent;
        if (e.properties.sessionID !== sessionId) return;
        
        if (streamingMessageRef.current && streamingMessageRef.current.id === e.properties.messageID) {
          streamingMessageRef.current.isStreaming = false;
          
          const currentMessage = streamingMessageRef.current;
          updateMessages(agentId, (messages) =>
            messages.map((m) =>
              m.id === currentMessage.id
                ? { ...m, isStreaming: false }
                : m
            )
          );
          streamingMessageRef.current = null;
        }
        
        setAgentLoading(agentId, false);
        break;
      }

      case 'session.updated': {
        const e = event as SessionUpdatedEvent;
        if (e.properties.info.id !== sessionId) return;
        
        // Update loading state based on session status
        const status = e.properties.info.status;
        if (status === 'running' || status === 'pending') {
          setAgentLoading(agentId, true);
        } else if (status === 'idle') {
          setAgentLoading(agentId, false);
        }
        break;
      }
    }
  }, [agentId, sessionId, updateMessages, setAgentLoading]);

  // Subscribe to SSE events when agent/port/session changes
  useEffect(() => {
    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!agentId || !port || !sessionId) return;

    // Connect and subscribe
    try {
      opencodeClient.connect(port);
      unsubscribeRef.current = opencodeClient.subscribeToEvents(handleEvent);
      console.log(`[SSE] Subscribed for agent ${agentId} on port ${port}`);
    } catch (err) {
      console.error('[SSE] Failed to subscribe:', err);
    }

    return () => {
      if (unsubscribeRef.current) {
        console.log(`[SSE] Unsubscribing for agent ${agentId}`);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [agentId, port, sessionId, handleEvent]);

  return {
    messages: agentId ? (agentMessages[agentId] || []) : [],
    isLoading: agentId ? (agentLoading[agentId] || false) : false,
  };
}

/**
 * Send a message using async API (for use with SSE streaming)
 * The response will come through SSE events
 */
export async function sendMessageAsync(
  port: number,
  sessionId: string,
  prompt: string,
  options?: { model?: string; agent?: string }
): Promise<void> {
  opencodeClient.connect(port);
  opencodeClient.setSession(sessionId);
  await opencodeClient.sendPromptAsync(prompt, options);
}
