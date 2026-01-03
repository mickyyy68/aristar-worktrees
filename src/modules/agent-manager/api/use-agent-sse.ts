import { useEffect, useRef, useCallback } from 'react';
import { useAgentManagerStore, getAgentKey } from '../store/agent-manager-store';
import { opencodeClient, opencodeClientManager } from './opencode';
import type { OpenCodeMessage } from './opencode';
import type { MessagePart } from '../store/types';
import { logger } from '@core/lib';

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
export function useAgentSSE(
  taskId: string | null,
  agentId: string | null,
  port: number | null,
  sessionId: string | null
) {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const streamingMessageRef = useRef<StreamingMessage | null>(null);
  
  // Buffer for parts that arrive before their parent message
  // Key: messageID, Value: array of { part, delta } objects
  const pendingPartsRef = useRef<Map<string, Array<{ part: any; delta: any }>>>(new Map());

  const {
    agentMessages,
    agentLoading,
  } = useAgentManagerStore();

  // Compute the composite key for this agent
  const agentKey = taskId && agentId ? getAgentKey(taskId, agentId) : null;

  // Helper to update agent messages in the store
  const updateMessages = useCallback((key: string, updater: (messages: OpenCodeMessage[]) => OpenCodeMessage[]) => {
    useAgentManagerStore.setState((state) => ({
      agentMessages: {
        ...state.agentMessages,
        [key]: updater(state.agentMessages[key] || []),
      },
    }));
  }, []);

  // Helper to set agent loading state
  const setAgentLoading = useCallback((key: string, loading: boolean) => {
    useAgentManagerStore.setState((state) => ({
      agentLoading: {
        ...state.agentLoading,
        [key]: loading,
      },
    }));
  }, []);

  // Helper to apply a part to the streaming message
  // Returns true if part was applied, false otherwise
  const applyPartToMessage = useCallback((part: any, delta: any): boolean => {
    if (!streamingMessageRef.current) {
      return false;
    }
    
    // Handle different part types
    if (part.type === 'text') {
      // Handle text delta - accumulate content
      if (delta && typeof delta === 'string') {
        streamingMessageRef.current.content += delta;
      } else if (part.text) {
        // Full text update (non-delta)
        streamingMessageRef.current.content = part.text;
      }
    } else if (part.type === 'tool') {
      const toolPart: MessagePart = {
        type: 'tool-invocation',
        toolInvocationId: part.callID || part.id,
        toolName: part.tool,
        state: part.state?.status || 'pending',
        args: part.state?.input,
        result: part.state?.output,
      };
      
      const existingPartIndex = streamingMessageRef.current.parts.findIndex(
        (p) => p.type === 'tool-invocation' && (p as { toolInvocationId?: string }).toolInvocationId === toolPart.toolInvocationId
      );
      
      if (existingPartIndex >= 0) {
        streamingMessageRef.current.parts[existingPartIndex] = toolPart;
      } else {
        streamingMessageRef.current.parts.push(toolPart);
      }
    } else if (part.type === 'reasoning') {
      const existingReasoningIndex = streamingMessageRef.current.parts.findIndex(
        (p) => p.type === 'reasoning'
      );
      
      const reasoningPart: MessagePart = {
        type: 'reasoning',
        text: part.text || '',
      };
      
      if (existingReasoningIndex >= 0) {
        streamingMessageRef.current.parts[existingReasoningIndex] = reasoningPart;
      } else {
        streamingMessageRef.current.parts.push(reasoningPart);
      }
    }
    // Unknown part types are silently ignored
    
    return true;
  }, []);

  // Handle SSE events
  const handleEvent = useCallback(async (event: SSEEvent) => {
    await logger.debug('[SSE]', 'handleEvent called', { taskId, agentId, agentKey, sessionId, eventType: event.type });
    
    if (!taskId || !agentId || !agentKey || !sessionId) {
      await logger.debug('[SSE]', 'Skipping - missing taskId, agentId, or sessionId', { taskId, agentId, sessionId });
      return;
    }

    const props = event.properties as Record<string, any>;
    await logger.debug('[SSE]', 'Event props', JSON.stringify(props, null, 2));
    
    // Filter events by session ID
    // sessionID location varies by event type:
    // - Top level: props?.sessionID (session.status, session.idle events)
    // - In info: props?.info?.sessionID (message.updated events)
    // - In part: props?.part?.sessionID (message.part.updated events)
    const eventSessionId = props?.sessionID || props?.info?.sessionID || props?.part?.sessionID;
    await logger.debug('[SSE]', 'Session ID check', { eventSessionId, expectedSessionId: sessionId, match: eventSessionId === sessionId });
    
    // Don't filter out events without session ID (like server.connected, heartbeat)
    if (eventSessionId && eventSessionId !== sessionId) {
      await logger.debug('[SSE]', 'Skipping - session ID mismatch');
      return;
    }

    await logger.debug('[SSE]', 'Processing event', { type: event.type });

    switch (event.type) {
      // message.updated - contains message info, used to create/update messages
      case 'message.updated': {
        await logger.debug('[SSE]', 'message.updated - processing');
        const info = props?.info;
        if (!info) {
          await logger.debug('[SSE]', 'message.updated - no info, skipping');
          return;
        }
        await logger.debug('[SSE]', 'message.updated - info', { id: info.id, role: info.role });
        
        if (info.role === 'user') {
          await logger.debug('[SSE]', 'message.updated - user message, skipping');
          return;
        }

        // Check if we already have this message
        const existingMessages = useAgentManagerStore.getState().agentMessages[agentKey] || [];
        const existingMessage = existingMessages.find(m => m.id === info.id);
        await logger.debug('[SSE]', 'message.updated - existing message check', { exists: !!existingMessage, messageCount: existingMessages.length });
        
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
          await logger.debug('[SSE]', 'message.updated - created new message', { id: newMessage.id });
          
          // Apply any buffered parts that arrived before this message was created
          const bufferedParts = pendingPartsRef.current.get(info.id);
          if (bufferedParts && bufferedParts.length > 0) {
            await logger.debug('[SSE]', 'message.updated - applying buffered parts', { count: bufferedParts.length });
            for (const { part, delta } of bufferedParts) {
              applyPartToMessage(part, delta);
            }
            // Clear the buffer for this message
            pendingPartsRef.current.delete(info.id);
            await logger.debug('[SSE]', 'message.updated - applied buffered parts, content length', { contentLength: newMessage.content.length });
          }

          // Add to messages (with any buffered content already applied)
          updateMessages(agentKey, (messages) => [...messages, newMessage as OpenCodeMessage]);
          setAgentLoading(agentKey, true);
          await logger.debug('[SSE]', 'message.updated - added message to store');
        } else {
          // Message exists but we may not have the streaming ref - recover it
          if (!streamingMessageRef.current || streamingMessageRef.current.id !== info.id) {
            streamingMessageRef.current = {
              ...existingMessage,
              parts: (existingMessage as StreamingMessage).parts || [],
              isStreaming: true,
            } as StreamingMessage;
            await logger.debug('[SSE]', 'message.updated - recovered streaming ref for existing message');
          }
        }
        break;
      }

      // message.part.updated - contains part with text delta for streaming
      case 'message.part.updated': {
        await logger.debug('[SSE]', 'message.part.updated - processing');
        const part = props?.part;
        const delta = props?.delta;
        await logger.debug('[SSE]', 'message.part.updated - part', { type: part?.type, messageID: part?.messageID, delta });
        
        if (!part) {
          await logger.debug('[SSE]', 'message.part.updated - no part, skipping');
          return;
        }
        
        const partMessageId = part.messageID;
        
        // If we don't have a streaming message yet, try to find an existing one
        if (!streamingMessageRef.current && partMessageId) {
          await logger.debug('[SSE]', 'message.part.updated - no streaming message, looking for existing');
          const existingMessages = useAgentManagerStore.getState().agentMessages[agentKey] || [];
          const existingMessage = existingMessages.find(m => m.id === partMessageId) as StreamingMessage | undefined;
          if (existingMessage) {
            // Preserve existing parts when recovering the streaming ref
            streamingMessageRef.current = {
              ...existingMessage,
              parts: existingMessage.parts || [],
              isStreaming: true,
            } as StreamingMessage;
            await logger.debug('[SSE]', 'message.part.updated - recovered streaming ref from existing message', { parts: streamingMessageRef.current.parts.length });
          } else {
            // Message not created yet - buffer this part for later
            // This handles the race condition where parts arrive before message.updated
            await logger.debug('[SSE]', 'message.part.updated - message not found, buffering part for later');
            
            if (!pendingPartsRef.current.has(partMessageId)) {
              pendingPartsRef.current.set(partMessageId, []);
            }
            pendingPartsRef.current.get(partMessageId)!.push({ part, delta });
            
            await logger.debug('[SSE]', 'message.part.updated - buffered part', { 
              messageId: partMessageId, 
              bufferSize: pendingPartsRef.current.get(partMessageId)!.length 
            });
            return;
          }
        }
        
        if (!streamingMessageRef.current) {
          await logger.debug('[SSE]', 'message.part.updated - still no streaming message, skipping');
          return;
        }
        
        if (partMessageId && streamingMessageRef.current.id !== partMessageId) {
          await logger.debug('[SSE]', 'message.part.updated - messageID mismatch, skipping');
          return;
        }

        // Apply the part to the streaming message
        applyPartToMessage(part, delta);
        await logger.debug('[SSE]', 'message.part.updated - applied part', { 
          type: part.type, 
          contentLength: streamingMessageRef.current.content.length 
        });

        // Update message in store with both content and parts
        const currentMessage = streamingMessageRef.current;
        if (!currentMessage) {
          await logger.debug('[SSE]', 'message.part.updated - no current message, skipping');
          return;
        }
        updateMessages(agentKey, (messages) =>
          messages.map((m) =>
            m.id === currentMessage.id
              ? { ...m, content: currentMessage.content, parts: [...currentMessage.parts] }
              : m
          )
        );
        await logger.debug('[SSE]', 'message.part.updated - updated store');
        break;
      }

      // session.status - indicates session state changes
      case 'session.status': {
        await logger.debug('[SSE]', 'session.status - processing');
        const status = props?.status;
        await logger.debug('[SSE]', 'session.status - status', { status });
        if (!status) return;
        
        const statusType = typeof status === 'object' ? status.type : status;
        await logger.debug('[SSE]', 'session.status - statusType', { statusType });
        
        if (statusType === 'busy' || statusType === 'running' || statusType === 'pending') {
          setAgentLoading(agentKey, true);
          await logger.debug('[SSE]', 'session.status - set loading true');
        } else if (statusType === 'idle') {
          await logger.debug('[SSE]', 'session.status - idle, completing message');
          // Session is idle - mark streaming complete
          if (streamingMessageRef.current) {
            streamingMessageRef.current.isStreaming = false;
            const currentMessage = streamingMessageRef.current;
            await logger.debug('[SSE]', 'session.status - final content', currentMessage.content.substring(0, 100) + '...');
            updateMessages(agentKey, (messages) =>
              messages.map((m) =>
                m.id === currentMessage.id
                  ? { ...m, isStreaming: false }
                  : m
              )
            );
            streamingMessageRef.current = null;
          }
          setAgentLoading(agentKey, false);
          await logger.debug('[SSE]', 'session.status - set loading false');
          
          // Mark agent as idle (completed processing)
          useAgentManagerStore.getState().markAgentIdle(taskId, agentId);
        }
        break;
      }

      // session.idle - session has finished processing
      case 'session.idle': {
        await logger.debug('[SSE]', 'session.idle - processing');
        if (streamingMessageRef.current) {
          streamingMessageRef.current.isStreaming = false;
          const currentMessage = streamingMessageRef.current;
          await logger.debug('[SSE]', 'session.idle - final content', currentMessage.content.substring(0, 100) + '...');
          updateMessages(agentKey, (messages) =>
            messages.map((m) =>
              m.id === currentMessage.id
                ? { ...m, isStreaming: false }
                : m
            )
          );
          streamingMessageRef.current = null;
        }
        setAgentLoading(agentKey, false);
        await logger.debug('[SSE]', 'session.idle - set loading false');
        
        // Mark agent as idle (completed processing)
        useAgentManagerStore.getState().markAgentIdle(taskId, agentId);
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
        updateMessages(agentKey, (messages) => [...messages, newMessage as OpenCodeMessage]);
        setAgentLoading(agentKey, true);
        break;
      }

      case 'message.completed': {
        const e = event as MessageCompletedEvent;
        if (streamingMessageRef.current && streamingMessageRef.current.id === e.properties.messageID) {
          streamingMessageRef.current.isStreaming = false;
          const currentMessage = streamingMessageRef.current;
          updateMessages(agentKey, (messages) =>
            messages.map((m) =>
              m.id === currentMessage.id
                ? { ...m, isStreaming: false }
                : m
            )
          );
          streamingMessageRef.current = null;
        }
        setAgentLoading(agentKey, false);
        break;
      }
    }
  }, [taskId, agentId, agentKey, sessionId, updateMessages, setAgentLoading, applyPartToMessage]);

  // Subscribe to SSE events when agent/port/session changes
  // Use per-agent client manager to register event handler
  // The actual SSE connection is established by startAgent before sending the prompt
  useEffect(() => {
    // Capture ref values for cleanup
    const pendingParts = pendingPartsRef.current;
    
    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!taskId || !agentId || !agentKey || !port || !sessionId) return;

    const subscribeAndLog = async () => {
      try {
        // Check if SSE is already connected (established by startAgent)
        if (opencodeClientManager.isSSEConnected(agentKey)) {
          // SSE is already connected, just register our handler
          unsubscribeRef.current = opencodeClientManager.registerEventHandler(agentKey, handleEvent);
          await logger.debug('[SSE]', `Handler registered for agent ${agentKey} (SSE already connected)`);
        } else {
          // SSE not connected yet - this can happen during session recovery
          // Establish connection and register handler
          try {
            await opencodeClientManager.establishSSEConnection(agentKey, port);
            unsubscribeRef.current = opencodeClientManager.registerEventHandler(agentKey, handleEvent);
            await logger.debug('[SSE]', `SSE established and handler registered for agent ${agentKey}`);
          } catch (err) {
            // If SSE connection fails, fall back to direct subscription
            await logger.warn('[SSE]', `Failed to establish SSE for ${agentKey}, falling back to direct subscription:`, err);
            const client = opencodeClientManager.getClient(agentKey, port);
            unsubscribeRef.current = client.subscribeToEvents(handleEvent);
            await logger.debug('[SSE]', `Fallback: Direct subscription for agent ${agentKey}`);
          }
        }
      } catch (err) {
        await logger.error('[SSE]', 'Failed to subscribe:', err);
      }
    };

    subscribeAndLog();

    return () => {
      if (unsubscribeRef.current) {
        logger.debug('[SSE]', `Unsubscribing for agent ${agentKey}`);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      // Clear pending parts buffer when unsubscribing
      pendingParts.clear();
      // Note: We don't clean up SSE here as it may be reused
      // SSE is cleaned up when agents are removed
    };
  }, [taskId, agentId, agentKey, port, sessionId, handleEvent]);

  const messages = agentKey ? (agentMessages[agentKey] || []) : [];
  const isLoadingState = agentKey ? (agentLoading[agentKey] || false) : false;
  
  logger.debug('[useAgentSSE]', 'Return values', {
    agentKey,
    messagesCount: messages.length,
    isLoading: isLoadingState,
    availableKeys: Object.keys(agentMessages),
  });
  
  return {
    messages,
    isLoading: isLoadingState,
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
