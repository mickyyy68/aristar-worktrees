import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Send, Users, Star, StopCircle, Terminal, Code, FolderOpen, Trash2, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Textarea } from '@core/ui/textarea';
import { Switch } from '@core/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@core/ui/tooltip';
import { Popover, PopoverAnchor } from '@core/ui/popover';
import { cn } from '@core/lib/utils';
import { useAppStore } from '@/store/use-app-store';
import { OptimizationPopover } from '../optimization-popover';
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
  onOptimize?: (prompt: string) => void;
  isOptimizing?: boolean;
  // Optimization popover props
  optimizationPopoverOpen?: boolean;
  onOptimizationPopoverChange?: (open: boolean) => void;
  originalPrompt?: string;
  optimizedPrompt?: string;
  onAcceptOptimized?: (prompt: string) => void;
  onDismissOptimization?: () => void;
}

export interface ChatInputRef {
  getMessage: () => string;
  setMessage: (message: string) => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput(
  {
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
    onOptimize,
    isOptimizing = false,
    // Optimization popover props
    optimizationPopoverOpen = false,
    onOptimizationPopoverChange,
    originalPrompt = '',
    optimizedPrompt = '',
    onAcceptOptimized,
    onDismissOptimization,
  },
  ref
) {
  const [message, setMessage] = useState('');
  const [sendToAll, setSendToAll] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if optimization model is configured
  const { settings } = useAppStore();
  const hasOptimizationModel = settings.optimizationModel !== undefined;

  // Expose message getter and setter to parent
  useImperativeHandle(ref, () => ({
    getMessage: () => message,
    setMessage: (newMessage: string) => setMessage(newMessage),
  }), [message]);

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

  const handleOptimize = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading || disabled || isOptimizing || !onOptimize || !hasOptimizationModel) return;
    onOptimize(trimmedMessage);
  }, [message, isLoading, disabled, isOptimizing, onOptimize, hasOptimizationModel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="rounded-xl border bg-card/50 p-3 transition-colors duration-200 focus-within:border-primary/30 focus-within:bg-card/70">
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className="min-h-[36px] max-h-[200px] resize-none border-0 bg-transparent px-1 py-2 text-sm leading-relaxed shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
        rows={1}
      />

      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
        <div className="flex items-center gap-1">
          {agent && (
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-muted/60 text-xs text-muted-foreground select-none">
              <Sparkles className="h-3 w-3" />
              <span className="font-medium">{agent.agentType || 'Agent'}</span>
              <span className="text-muted-foreground/70">·</span>
              <span className="font-mono text-[10px]">{agent.modelId}</span>
            </div>
          )}

          {agentCount > 1 && (
            <div className="flex items-center gap-1.5 ml-2">
              <Switch
                id="send-to-all"
                checked={sendToAll}
                onCheckedChange={setSendToAll}
                disabled={disabled || isLoading}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors select-none',
                      sendToAll ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <Users className="h-3 w-3" />
                    <span>All</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Send message to all agents simultaneously
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {onOpenTerminal && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onOpenTerminal}>
                  <Terminal className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Open in Terminal</TooltipContent>
            </Tooltip>
          )}
          {onOpenEditor && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onOpenEditor}>
                  <Code className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Open in Editor</TooltipContent>
            </Tooltip>
          )}
          {onRevealInFinder && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onRevealInFinder}>
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Reveal in Finder</TooltipContent>
            </Tooltip>
          )}
          {onAccept && agent && !agent.accepted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/10" onClick={onAccept}>
                  <Star className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Accept Agent</TooltipContent>
            </Tooltip>
          )}
          {onStop && agent?.status === 'running' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10" onClick={onStop}>
                  <StopCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Stop Agent</TooltipContent>
            </Tooltip>
          )}
          {onRemove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/80 hover:text-destructive hover:bg-destructive/10" onClick={onRemove}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Remove Agent</TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-5 bg-border/60 mx-1" />

          {onOptimize && (
            <Popover open={optimizationPopoverOpen} onOpenChange={onOptimizationPopoverChange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverAnchor asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 text-muted-foreground hover:text-foreground",
                        isOptimizing && "animate-pulse text-primary",
                        !hasOptimizationModel && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={handleOptimize}
                      disabled={disabled || isLoading || isOptimizing || !message.trim() || !hasOptimizationModel}
                    >
                      {isOptimizing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </PopoverAnchor>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isOptimizing 
                    ? 'Optimizing...' 
                    : !hasOptimizationModel 
                      ? 'Set a model in Settings to enable' 
                      : 'Optimize prompt'}
                </TooltipContent>
              </Tooltip>
              {onAcceptOptimized && onDismissOptimization && onOptimizationPopoverChange && (
                <OptimizationPopover
                  originalPrompt={originalPrompt}
                  optimizedPrompt={optimizedPrompt}
                  onAccept={onAcceptOptimized}
                  onDismiss={onDismissOptimization}
                  isOpen={optimizationPopoverOpen}
                  onOpenChange={onOptimizationPopoverChange}
                />
              )}
            </Popover>
          )}

          <Button
            onClick={handleSend}
            disabled={disabled || isLoading || isOptimizing || !message.trim()}
            size="sm"
            className={cn(
              "h-8 px-3 gap-1.5 transition-all duration-200",
              !message.trim() ? "opacity-50" : ""
            )}
          >
            <Send className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
});
