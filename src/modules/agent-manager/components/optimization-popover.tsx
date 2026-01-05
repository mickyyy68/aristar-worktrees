/**
 * Optimization Popover Content
 *
 * A popover content component that shows the original and optimized prompts,
 * allowing the user to review, edit, copy, and accept or dismiss the optimization.
 * 
 * This component only renders the PopoverContent - the parent Popover wrapper
 * and PopoverAnchor should be provided by the consuming component (e.g., ChatInput).
 */

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, X } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Textarea } from '@core/ui/textarea';
import { PopoverContent } from '@core/ui/popover';
import { cn } from '@core/lib/utils';

interface OptimizationPopoverProps {
  originalPrompt: string;
  optimizedPrompt: string;
  onAccept: (prompt: string) => void;
  onDismiss: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OptimizationPopover({
  originalPrompt,
  optimizedPrompt,
  onAccept,
  onDismiss,
  isOpen,
  onOpenChange,
}: OptimizationPopoverProps) {
  const [editedPrompt, setEditedPrompt] = useState(optimizedPrompt);
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when popover opens with new content
  useEffect(() => {
    if (isOpen) {
      setEditedPrompt(optimizedPrompt);
      setIsOriginalExpanded(false);
      setCopied(false);
    }
  }, [isOpen, optimizedPrompt]);

  const handleAccept = useCallback(() => {
    onAccept(editedPrompt);
    onOpenChange(false);
  }, [editedPrompt, onAccept, onOpenChange]);

  const handleDismiss = useCallback(() => {
    onDismiss();
    onOpenChange(false);
  }, [onDismiss, onOpenChange]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  }, [editedPrompt]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter to accept
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAccept();
      }
      // Escape to dismiss
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleAccept, handleDismiss]);

  return (
    <PopoverContent
      className="w-[420px] p-0"
      side="top"
      align="end"
      sideOffset={8}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
          <Check className="h-3 w-3 text-green-500" />
        </div>
        <span className="text-sm font-medium">Prompt Optimized</span>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {/* Original Prompt (collapsible) */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setIsOriginalExpanded(!isOriginalExpanded)}
            className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isOriginalExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span>Original prompt</span>
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              isOriginalExpanded ? 'max-h-[120px]' : 'max-h-0'
            )}
          >
            <div className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground overflow-y-auto max-h-[120px]">
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                {originalPrompt}
              </pre>
            </div>
          </div>
        </div>

        {/* Optimized Prompt (editable) */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Optimized prompt
          </label>
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            rows={6}
            className="resize-none text-xs font-mono leading-relaxed"
            placeholder="Optimized prompt will appear here..."
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-[10px] text-muted-foreground">
          Cmd+Enter to accept
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
            Dismiss
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 px-3 text-xs"
            onClick={handleAccept}
            disabled={!editedPrompt.trim()}
          >
            <Check className="h-3 w-3" />
            Accept
          </Button>
        </div>
      </div>
    </PopoverContent>
  );
}
