/**
 * Optimization Review Dialog
 *
 * A dialog that shows the original and optimized prompts side-by-side,
 * allowing the user to review, edit, and accept or cancel the optimization.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@core/ui/button';
import { Textarea } from '@core/ui/textarea';
import { Label } from '@core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@core/ui/dialog';

interface OptimizationReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPrompt: string;
  optimizedPrompt: string;
  onAccept: (optimizedPrompt: string) => void;
  onCancel: () => void;
}

export function OptimizationReviewDialog({
  open,
  onOpenChange,
  originalPrompt,
  optimizedPrompt,
  onAccept,
  onCancel,
}: OptimizationReviewDialogProps) {
  const [editedPrompt, setEditedPrompt] = useState(optimizedPrompt);

  // Reset edited prompt when dialog opens with new content
  useEffect(() => {
    if (open) {
      setEditedPrompt(optimizedPrompt);
    }
  }, [open, optimizedPrompt]);

  const handleAccept = useCallback(() => {
    onAccept(editedPrompt);
    onOpenChange(false);
  }, [editedPrompt, onAccept, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter to accept
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAccept();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleAccept, handleCancel]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Review Optimized Prompt</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Review the AI-optimized prompt and make any adjustments before accepting.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-4">
          {/* Original Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Original Prompt</Label>
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <pre className="whitespace-pre-wrap font-sans">{originalPrompt}</pre>
            </div>
          </div>

          {/* Optimized Prompt (editable) */}
          <div className="space-y-1.5">
            <Label htmlFor="optimized-prompt" className="text-xs text-muted-foreground">
              Optimized Prompt
            </Label>
            <Textarea
              id="optimized-prompt"
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              rows={10}
              className="resize-none text-sm font-mono"
              placeholder="Optimized prompt will appear here..."
            />
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Press Cmd+Enter to accept
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleAccept} disabled={!editedPrompt.trim()}>
                Accept
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
