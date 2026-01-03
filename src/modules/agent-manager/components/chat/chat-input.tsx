import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Users, MoreHorizontal, Star, StopCircle, Terminal, Code, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Textarea } from '@core/ui/textarea';
import { Label } from '@core/ui/label';
import { Switch } from '@core/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@core/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@core/ui/dropdown-menu';
import { cn } from '@core/lib/utils';
import type { TaskAgent } from '../../store/types';

interface ChatInputProps {
  onSend: (message: string, sendToAll: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  agentCount?: number;
  agent?: TaskAgent;
  onAccept?: () => void;
  onStop?: () => void;
  onOpenTerminal?: () => void;
  onOpenEditor?: () => void;
  onRevealInFinder?: () => void;
  onRemove?: () => void;
}

export function ChatInput({
  onSend,
  isLoading = false,
  disabled = false,
  placeholder = 'Type a message...',
  agentCount = 1,
  agent,
  onAccept,
  onStop,
  onOpenTerminal,
  onOpenEditor,
  onRevealInFinder,
  onRemove,
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

  const showAgentActions = agent && (onAccept || onStop || onOpenTerminal || onOpenEditor);

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      {/* Textarea input */}
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        rows={1}
      />

      {/* Bottom toolbar */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Agent selector dropdown (placeholder for agent type) */}
          {agent && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
              <span className="opacity-70">Agent</span>
              <span className="font-medium text-foreground">{agent.agentType || 'Agent'}</span>
            </Button>
          )}

          {/* Model indicator */}
          {agent && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
              {agent.modelId}
            </Button>
          )}

          {/* Send to all toggle - only show if there are multiple agents */}
          {agentCount > 1 && (
            <div className="flex items-center gap-1.5">
              <Switch
                id="send-to-all"
                checked={sendToAll}
                onCheckedChange={setSendToAll}
                disabled={disabled || isLoading}
                className="scale-75"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label
                    htmlFor="send-to-all"
                    className={cn(
                      'flex cursor-pointer items-center gap-1 text-xs',
                      sendToAll ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <Users className="h-3 w-3" />
                    All
                  </Label>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Send message to all agents simultaneously
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Agent actions menu */}
          {showAgentActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onOpenTerminal && (
                  <DropdownMenuItem onClick={onOpenTerminal}>
                    <Terminal className="mr-2 h-4 w-4" />
                    Open in Terminal
                  </DropdownMenuItem>
                )}
                {onOpenEditor && (
                  <DropdownMenuItem onClick={onOpenEditor}>
                    <Code className="mr-2 h-4 w-4" />
                    Open in Editor
                  </DropdownMenuItem>
                )}
                {onRevealInFinder && (
                  <DropdownMenuItem onClick={onRevealInFinder}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Reveal in Finder
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onAccept && !agent?.accepted && (
                  <DropdownMenuItem onClick={onAccept}>
                    <Star className="mr-2 h-4 w-4" />
                    Accept Agent
                  </DropdownMenuItem>
                )}
                {onStop && agent?.status === 'running' && (
                  <DropdownMenuItem onClick={onStop} className="text-destructive">
                    <StopCircle className="mr-2 h-4 w-4" />
                    Stop Agent
                  </DropdownMenuItem>
                )}
                {onRemove && (
                  <DropdownMenuItem onClick={onRemove} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Agent
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={disabled || isLoading || !message.trim()}
            size="icon"
            className="h-7 w-7"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
