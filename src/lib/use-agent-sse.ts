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

interface MessageCompletedEvent extends SSEEvent {
  type: 'message.completed';
  properties: {
    sessionID: string;
    messageID: string;
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
    console.log('[SSE] handleEvent called:', { agentId, sessionId, eventType: event.type });
    
    if (!agentId || !sessionId) {
      console.log('[SSE] Skipping - no agentId or sessionId:', { agentId, sessionId });
      return;
    }

    const props = event.properties as Record<string, any>;
    console.log('[SSE] Event props:', JSON.stringify(props, null, 2));
    
    // Filter events by session ID
    const eventSessionId = props?.sessionID || props?.info?.id;
    console.log('[SSE] Session ID check:', { eventSessionId, expectedSessionId: sessionId, match: eventSessionId === sessionId });
    
    // Don't filter out events without session ID (like server.connected, heartbeat)
    if (eventSessionId && eventSessionId !== sessionId) {
      console.log('[SSE] Skipping - session ID mismatch');
      return;
    }

    console.log('[SSE] Processing event:', event.type);

    switch (event.type) {
      // message.updated - contains message info, used to create/update messages
      case 'message.updated': {
        console.log('[SSE] message.updated - processing');
        const info = props?.info;
        if (!info) {
          console.log('[SSE] message.updated - no info, skipping');
          return;
        }
        console.log('[SSE] message.updated - info:', { id: info.id, role: info.role });
        
        if (info.role === 'user') {
          console.log('[SSE] message.updated - user message, skipping');
          return;
        }

        // Check if we already have this message
        const existingMessages = useAgentManagerStore.getState().agentMessages[agentId] || [];
        const existingMessage = existingMessages.find(m => m.id === info.id);
        console.log('[SSE] message.updated - existing message check:', { exists: !!existingMessage, messageCount: existingMessages.length });
        
        if (!existingMessage) {
          // Create new streaming message
          const newMessage: StreamingMessage = {
            id: info.id,
            role: info.role,
            content: '',
            timestamp: new Date(info.time?.created || Date.now()),
            parts: [],
            isStreaming: true,
          };
          streamingMessageRef.current = newMessage;
          console.log('[SSE] message.updated - created new message:', newMessage.id);

          // Add to messages
          updateMessages(agentId, (messages) => [...messages, newMessage as OpenCodeMessage]);
          setAgentLoading(agentId, true);
          console.log('[SSE] message.updated - added message to store');
        }
        break;
      }

      // message.part.updated - contains part with text delta for streaming
      case 'message.part.updated': {
        console.log('[SSE] message.part.updated - processing');
        const part = props?.part;
        const delta = props?.delta;
        console.log('[SSE] message.part.updated - part:', { type: part?.type, messageID: part?.messageID, delta });
        
        if (!part) {
          console.log('[SSE] message.part.updated - no part, skipping');
          return;
        }
        
        // If we don't have a streaming message yet, create one
        if (!streamingMessageRef.current && part.messageID) {
          console.log('[SSE] message.part.updated - no streaming message, looking for existing');
          const existingMessages = useAgentManagerStore.getState().agentMessages[agentId] || [];
          const existingMessage = existingMessages.find(m => m.id === part.messageID);
          if (existingMessage) {
            streamingMessageRef.current = {
              ...existingMessage,
              parts: [],
              isStreaming: true,
            } as StreamingMessage;
            console.log('[SSE] message.part.updated - created streaming ref from existing message');
          } else {
            // Create a new message if we don't have one
            console.log('[SSE] message.part.updated - creating new message for part');
            const newMessage: StreamingMessage = {
              id: part.messageID,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              parts: [],
              isStreaming: true,
            };
            streamingMessageRef.current = newMessage;
            updateMessages(agentId, (messages) => [...messages, newMessage as OpenCodeMessage]);
            setAgentLoading(agentId, true);
          }
        }
        
        if (!streamingMessageRef.current) {
          console.log('[SSE] message.part.updated - still no streaming message, skipping');
          return;
        }
        
        if (part.messageID && streamingMessageRef.current.id !== part.messageID) {
          console.log('[SSE] message.part.updated - messageID mismatch, skipping');
          return;
        }

        // Handle text delta - accumulate content
        if (delta && typeof delta === 'string') {
          streamingMessageRef.current.content += delta;
          console.log('[SSE] message.part.updated - appended delta, content length:', streamingMessageRef.current.content.length);
        } else if (part.type === 'text' && part.text) {
          // Full text update (non-delta)
          streamingMessageRef.current.content = part.text;
          console.log('[SSE] message.part.updated - set full text, content length:', streamingMessageRef.current.content.length);
        }

        // Update message in store
        const currentMessage = streamingMessageRef.current;
        updateMessages(agentId, (messages) =>
          messages.map((m) =>
            m.id === currentMessage.id
              ? { ...m, content: currentMessage.content }
              : m
          )
        );
        console.log('[SSE] message.part.updated - updated store');
        break;
      }

      // session.status - indicates session state changes
      case 'session.status': {
        console.log('[SSE] session.status - processing');
        const status = props?.status;
        console.log('[SSE] session.status - status:', status);
        if (!status) return;
        
        const statusType = typeof status === 'object' ? status.type : status;
        console.log('[SSE] session.status - statusType:', statusType);
        
        if (statusType === 'busy' || statusType === 'running' || statusType === 'pending') {
          setAgentLoading(agentId, true);
          console.log('[SSE] session.status - set loading true');
        } else if (statusType === 'idle') {
          console.log('[SSE] session.status - idle, completing message');
          // Session is idle - mark streaming complete
          if (streamingMessageRef.current) {
            streamingMessageRef.current.isStreaming = false;
            const currentMessage = streamingMessageRef.current;
            console.log('[SSE] session.status - final content:', currentMessage.content.substring(0, 100) + '...');
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
          console.log('[SSE] session.status - set loading false');
        }
        break;
      }

      // session.idle - session has finished processing
      case 'session.idle': {
        console.log('[SSE] session.idle - processing');
        if (streamingMessageRef.current) {
          streamingMessageRef.current.isStreaming = false;
          const currentMessage = streamingMessageRef.current;
          console.log('[SSE] session.idle - final content:', currentMessage.content.substring(0, 100) + '...');
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
        console.log('[SSE] session.idle - set loading false');
        break;
      }

      // Legacy event types (keep for compatibility)
      case 'message.created': {
        const e = event as MessageCreatedEvent;
        if (e.properties.info.role === 'user') return;

        const newMessage: StreamingMessage = {
          id: e.properties.info.id,
          role: e.properties.info.role,
          content: '',
          timestamp: new Date(e.properties.info.created),
          parts: [],
          isStreaming: true,
        };
        streamingMessageRef.current = newMessage;
        updateMessages(agentId, (messages) => [...messages, newMessage as OpenCodeMessage]);
        setAgentLoading(agentId, true);
        break;
      }

      case 'message.completed': {
        const e = event as MessageCompletedEvent;
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
