import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@core/ui/scroll-area';
import { ChatMessage, ChatMessageLoading } from './chat-message';
import type { Message, MessagePart } from '../../api/opencode-types';
import { logger } from '@core/lib';

interface ChatViewProps {
  messages: Message[];
  isLoading?: boolean;
}

/**
 * Consolidate consecutive assistant messages into single messages.
 * This groups tool-only messages with subsequent text messages,
 * providing a cleaner chat experience.
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
        // Use the later timestamp
        timestamp: message.timestamp,
      };
    } else {
      // Can't merge, add as new message
      result.push({ ...message });
    }
  }
  
  return result;
}

export function ChatView({ messages, isLoading = false }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  logger.debug('[ChatView]', 'Received messages', { count: messages.length, firstFew: messages.slice(0, 3).map(m => ({ id: m.id, role: m.role, contentLength: m.content?.length })) });

  // Filter out assistant messages with no content - they're still loading/streaming
  // and will be shown once content arrives via SSE
  const messagesWithContent = useMemo(
    () => messages.filter(m => {
      // Always show user messages
      if (m.role === 'user') return true;
      // Only show assistant messages that have content or parts with tools
      const hasContent = m.content && m.content.trim().length > 0;
      const hasToolParts = m.parts?.some(p => p.type === 'tool-invocation');
      // Debug log
      if (m.role === 'assistant') {
        console.log('[ChatView] Message filter:', { id: m.id, hasContent, hasToolParts, partsTypes: m.parts?.map(p => p.type) });
      }
      return hasContent || hasToolParts;
    }),
    [messages]
  );
  
  logger.debug('[ChatView]', 'After filtering empty', { count: messagesWithContent.length });

  // Consolidate consecutive assistant messages
  const consolidatedMessages = useMemo(
    () => consolidateMessages(messagesWithContent),
    [messagesWithContent]
  );
  
  logger.debug('[ChatView]', 'After consolidation', { count: consolidatedMessages.length });

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
