import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@core/ui/scroll-area';
import { ChatMessage, ChatMessageLoading } from './chat-message';
import type { OpenCodeMessage } from '../../api/opencode';
import type { MessagePart } from '../../store/types';

interface ChatViewProps {
  messages: OpenCodeMessage[];
  isLoading?: boolean;
}

type MessageWithParts = OpenCodeMessage & { parts?: MessagePart[] };

/**
 * Consolidate consecutive assistant messages into single messages.
 * This groups tool-only messages with subsequent text messages,
 * providing a cleaner chat experience.
 */
function consolidateMessages(messages: OpenCodeMessage[]): MessageWithParts[] {
  const result: MessageWithParts[] = [];
  
  for (const message of messages) {
    const msg = message as MessageWithParts;
    const lastMsg = result[result.length - 1];
    
    // Check if we can merge with the previous message
    // Merge if: both are assistant messages, and the previous has no text content (tool-only)
    if (
      lastMsg &&
      lastMsg.role === 'assistant' &&
      msg.role === 'assistant' &&
      !lastMsg.content?.trim()
    ) {
      // Merge: combine parts from both messages
      const combinedParts = [
        ...(lastMsg.parts || []),
        ...(msg.parts || []),
      ];
      
      // Update the last message with combined content and parts
      result[result.length - 1] = {
        ...lastMsg,
        content: msg.content || lastMsg.content,
        parts: combinedParts,
        // Use the later timestamp
        timestamp: msg.timestamp,
      };
    } else {
      // Can't merge, add as new message
      result.push({ ...msg });
    }
  }
  
  return result;
}

export function ChatView({ messages, isLoading = false }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  console.log('[ChatView] Received messages:', messages.length, 'first few:', messages.slice(0, 3).map(m => ({ id: m.id, role: m.role, contentLength: m.content?.length })));

  // Consolidate consecutive assistant messages
  const consolidatedMessages = useMemo(
    () => consolidateMessages(messages),
    [messages]
  );
  
  console.log('[ChatView] After consolidation:', consolidatedMessages.length);

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
