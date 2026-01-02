import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string, sendToAll: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  agentCount?: number;
}

export function ChatInput({
  onSend,
  isLoading = false,
  disabled = false,
  placeholder = 'Type a message...',
  agentCount = 1,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [sendToAll, setSendToAll] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading || disabled) return;
    
    onSend(trimmedMessage, sendToAll);
    setMessage('');
  }, [message, isLoading, disabled, onSend, sendToAll]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-card p-4">
      {/* Send to all toggle - only show if there are multiple agents */}
      {agentCount > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <Switch
            id="send-to-all"
            checked={sendToAll}
            onCheckedChange={setSendToAll}
            disabled={disabled || isLoading}
          />
          <Label
            htmlFor="send-to-all"
            className={cn(
              'flex cursor-pointer items-center gap-1.5 text-sm',
              sendToAll ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Users className="h-4 w-4" />
            Send to all agents
          </Label>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="min-h-[44px] max-h-[200px] resize-none"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || isLoading || !message.trim()}
          size="icon"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        Press{' '}
        <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">
          {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}
        </kbd>
        +
        <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">
          Enter
        </kbd>{' '}
        to send
      </div>
    </div>
  );
}
