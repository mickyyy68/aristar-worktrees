import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, ChatMessageLoading } from '@/components/agent-manager/chat-message';
import type { OpenCodeMessage } from '@/lib/opencode';

interface ChatViewProps {
  messages: OpenCodeMessage[];
  isLoading?: boolean;
}

export function ChatView({ messages, isLoading = false }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
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
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && <ChatMessageLoading />}
      </div>
    </ScrollArea>
  );
}
