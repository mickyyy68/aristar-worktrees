'use client';

import { useState, useEffect } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Input } from '@core/ui/input';
import { Textarea } from '@core/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@core/ui/dialog';
import { Label } from '@core/ui/label';
import { Switch } from '@core/ui/switch';
import { useAppStore } from '@/store/use-app-store';
import { cn } from '@core/lib/utils';
import type { CommitInfo, SourceType } from '@/store/types';
// Import the shared SourceSelector from agent-manager
import { SourceSelector } from '@agent-manager/components/source-selector';

interface CreateWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorktreeDialog({ open, onOpenChange }: CreateWorktreeDialogProps) {
  const { selectedRepositoryId, repositories, createWorktree } = useAppStore();
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('current-branch');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [startupScript, setStartupScript] = useState('');
  const [executeScript, setExecuteScript] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);

  const selectedRepo = repositories.find(r => r.id === selectedRepositoryId);

  useEffect(() => {
    if (open && selectedRepo) {
      setName('');
      setSourceType('current-branch');
      setSelectedBranch('');
      setSelectedCommit(null);
      setStartupScript('');
      setExecuteScript(false);
      setError(null);
      setShowAdvanced(false);
    }
  }, [open, selectedRepo]);

  const handleSubmit = async () => {
    if (!selectedRepo || !name.trim()) {
      setError('Please enter a worktree name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createWorktree(
        selectedRepo.path,
        name.trim(),
        sourceType === 'existing-branch' ? selectedBranch : undefined,
        sourceType === 'commit' && selectedCommit ? selectedCommit.hash : undefined,
        startupScript.trim() || undefined,
        executeScript && startupScript.trim() ? true : false
      );
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '-');
    setName(sanitized);
  };

  if (!selectedRepo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>New Worktree</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-4">
          {/* Worktree name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
            <Input
              id="name"
              placeholder="feature/my-feature"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Source selector - reuse the same component as CreateTaskDialog */}
          <SourceSelector
            repoPath={selectedRepo.path}
            sourceType={sourceType}
            onSourceTypeChange={setSourceType}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            selectedCommit={selectedCommit}
            onCommitChange={setSelectedCommit}
            compact
          />

          {/* Advanced options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")} />
            Advanced options
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Startup Script</Label>
                <Textarea
                  placeholder="#!/bin/bash&#10;npm install"
                  value={startupScript}
                  onChange={(e) => setStartupScript(e.target.value)}
                  rows={3}
                  className="resize-none font-mono text-xs"
                />
              </div>

              {startupScript.trim() && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="execute-script" className="text-xs cursor-pointer">
                    Execute on creation
                  </Label>
                  <Switch
                    id="execute-script"
                    checked={executeScript}
                    onCheckedChange={setExecuteScript}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
