/**
 * Agent Messages Hook
 *
 * Read-only hook for accessing agent messages.
 * Does NOT manage SSE subscriptions - that's handled imperatively by the store.
 *
 * This hook simply reads from the message store and combines completed
 * and streaming messages into a single array.
 */

import { useMemo } from 'react';
import { useMessageStore } from '../store/message-store';
import type { Message } from '../api/opencode-types';

const EMPTY_ARRAY: Message[] = [];

export interface UseAgentMessagesResult {
  /** All messages (completed + streaming) */
  messages: Message[];
  /** Whether the agent is currently loading/streaming */
  isLoading: boolean;
  /** The currently streaming message, if any */
  streamingMessage: Message | null;
}

/**
 * Hook to get messages for a specific agent
 *
 * @param agentKey - The composite key (taskId:agentId) for the agent, or null
 * @returns Messages, loading state, and streaming message
 */
export function useAgentMessages(agentKey: string | null): UseAgentMessagesResult {
  // Select completed messages - use stable empty array to avoid selector reference churn
  const completedMessages = useMessageStore((state) =>
    agentKey ? (state.messages[agentKey] ?? EMPTY_ARRAY) : EMPTY_ARRAY
  );

  // Select streaming message
  const streamingMessage = useMessageStore((state) =>
    agentKey ? (state.streamingMessages[agentKey] ?? null) : null
  );

  // Select loading state
  const isLoading = useMessageStore((state) =>
    agentKey ? (state.loading[agentKey] ?? false) : false
  );

  // Combine completed and streaming messages
  const messages = useMemo(() => {
    if (!streamingMessage) {
      return completedMessages;
    }
    // Create new array with streaming message appended
    const result = new Array(completedMessages.length + 1);
    for (let i = 0; i < completedMessages.length; i++) {
      result[i] = completedMessages[i];
    }
    result[completedMessages.length] = streamingMessage;
    return result;
  }, [completedMessages, streamingMessage]);

  return {
    messages,
    isLoading,
    streamingMessage,
  };
}

/**
 * Convenience hook that takes taskId and agentId separately
 */
export function useAgentMessagesById(
  taskId: string | null,
  agentId: string | null
): UseAgentMessagesResult {
  const agentKey = taskId && agentId ? `${taskId}:${agentId}` : null;
  return useAgentMessages(agentKey);
}
