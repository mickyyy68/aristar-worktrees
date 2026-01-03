import { User, Bot } from 'lucide-react';
import { MarkdownRenderer } from '@core/ui/markdown-renderer';
import { ToolsSection } from '../tools/tools-section';
import { cn } from '@core/lib/utils';
import type { Message, ToolInvocationPart } from '../../api/opencode-types';

interface ChatMessageProps {
  message: Message;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Extract tool calls from parts if available
  const toolCalls = message.parts?.filter(
    (part): part is ToolInvocationPart => part.type === 'tool-invocation'
  ) || [];

  return (
    <div
      className={cn(
        'mb-3 flex gap-2',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
            ? 'bg-muted text-muted-foreground'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isUser ? (
          <User className="h-3 w-3" />
        ) : (
          <Bot className="h-3 w-3" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-0.5',
          isUser && 'items-end'
        )}
      >
        <div
          className={cn(
            'rounded-xl px-3 py-1.5 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : isSystem
              ? 'bg-muted text-muted-foreground rounded-bl-sm'
              : 'bg-card border rounded-bl-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <>
              <MarkdownRenderer content={message.content} className="text-sm" />
              {toolCalls.length > 0 && <ToolsSection toolCalls={toolCalls} />}
            </>
          )}
        </div>
        <span className="px-2 text-[10px] text-muted-foreground">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

// Loading indicator for when agent is thinking
export function ChatMessageLoading() {
  return (
    <div className="mb-3 flex gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Bot className="h-3 w-3" />
      </div>
      <div className="rounded-xl rounded-bl-sm border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
