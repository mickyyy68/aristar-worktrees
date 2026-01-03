import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@core/ui/scroll-area';
import { ChatMessage, ChatMessageLoading } from './chat-message';
import type { Message, MessagePart } from '../../api/opencode-types';

interface ChatViewProps {
  messages: Message[];
  isLoading?: boolean;
}

/**
 * Consolidate consecutive assistant messages into single messages.
 * This groups tool-only messages with subsequent text messages,
 * providing a cleaner chat experience.
 *
 * OpenCode often sends multiple messages in sequence:
 * 1. A tool-only message (with tool invocations)
 * 2. A text response message (with the final answer)
 *
 * This function merges them so the UI shows tools and text together.
 */
function consolidateMessages(messages: Message[]): Message[] {
  const result: Message[] = [];

  for (const message of messages) {
    const lastMsg = result[result.length - 1];

    // Check if we can merge with the previous message
    // Merge if: both are assistant messages, and the previous has no text content (tool-only)
    if (
      lastMsg &&
      lastMsg.role === 'assistant' &&
      message.role === 'assistant' &&
      !lastMsg.content?.trim()
    ) {
      // Merge: combine parts from both messages
      const combinedParts: MessagePart[] = [
        ...(lastMsg.parts || []),
        ...(message.parts || []),
      ];

      // Update the last message with combined content and parts
      result[result.length - 1] = {
        ...lastMsg,
        content: message.content || lastMsg.content,
        parts: combinedParts,
        timestamp: message.timestamp,
      };
    } else {
      result.push({ ...message });
    }
  }

  return result;
}

export function ChatView({ messages, isLoading = false }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Filter out assistant messages with no content or tools (still loading)
  const messagesWithContent = useMemo(
    () =>
      messages.filter((m) => {
        if (m.role === 'user') return true;
        const hasContent = m.content && m.content.trim().length > 0;
        const hasToolParts = m.parts?.some((p) => p.type === 'tool-invocation');
        return hasContent || hasToolParts;
      }),
    [messages]
  );

  // Consolidate consecutive assistant messages (tool + text)
  const consolidatedMessages = useMemo(
    () => consolidateMessages(messagesWithContent),
    [messagesWithContent]
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consolidatedMessages, isLoading]);

  if (consolidatedMessages.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-center">
          No messages yet.
          <br />
          Start a conversation to see the agent&apos;s responses.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {consolidatedMessages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && <ChatMessageLoading />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
