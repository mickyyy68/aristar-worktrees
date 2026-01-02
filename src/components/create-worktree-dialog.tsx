'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Search, GitCommit, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/use-app-store';
import * as commands from '@/lib/commands';
import type { BranchInfo, CommitInfo, SourceType } from '@/store/types';

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
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Commit selection state
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitSearch, setCommitSearch] = useState('');
  const [loadingCommits, setLoadingCommits] = useState(false);

  const selectedRepo = repositories.find(r => r.id === selectedRepositoryId);

  // Filter commits based on search (local filtering for performance)
  const filteredCommits = useMemo(() => {
    if (!commitSearch.trim()) return commits;
    const search = commitSearch.toLowerCase();
    return commits.filter(c => 
      c.shortHash.toLowerCase().includes(search) ||
      c.hash.toLowerCase().includes(search) ||
      c.message.toLowerCase().includes(search) ||
      c.author.toLowerCase().includes(search)
    );
  }, [commits, commitSearch]);

  const loadBranches = useCallback(async () => {
    if (!selectedRepo) return;
    try {
      const branchList = await commands.getBranches(selectedRepo.path);
      setBranches(branchList);
      const currentBranch = branchList.find(b => b.isCurrent);
      if (currentBranch) {
        setSelectedBranch(currentBranch.name);
      }
    } catch (err) {
      setError('Failed to load branches');
    }
  }, [selectedRepo]);

  const loadCommits = useCallback(async () => {
    if (!selectedRepo) return;
    setLoadingCommits(true);
    try {
      const commitList = await commands.getCommits(selectedRepo.path, 50);
      setCommits(commitList);
    } catch (err) {
      setError('Failed to load commits');
    } finally {
      setLoadingCommits(false);
    }
  }, [selectedRepo]);

  useEffect(() => {
    if (open && selectedRepo) {
      loadBranches();
      setName('');
      setSourceType('current-branch');
      setSelectedBranch('');
      setSelectedCommit(null);
      setCommitSearch('');
      setCommits([]);
      setStartupScript('');
      setExecuteScript(false);
      setError(null);
    }
  }, [open, selectedRepo, loadBranches]);

  // Load commits when source type changes to 'commit'
  useEffect(() => {
    if (sourceType === 'commit' && commits.length === 0 && selectedRepo) {
      loadCommits();
    }
  }, [sourceType, commits.length, selectedRepo, loadCommits]);

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Worktree</DialogTitle>
          <DialogDescription>
            Create a new worktree for {selectedRepo.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Worktree Name</Label>
            <Input
              id="name"
              placeholder="feature/my-feature"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-branch">Current Branch</SelectItem>
                <SelectItem value="existing-branch">Existing Branch</SelectItem>
                <SelectItem value="commit">Specific Commit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sourceType === 'existing-branch' && (
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter(b => !b.isRemote).map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {sourceType === 'commit' && (
            <div className="space-y-2">
              <Label>Select Commit</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search commits..."
                  value={commitSearch}
                  onChange={(e) => setCommitSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[200px] rounded-md border">
                {loadingCommits ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCommits.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    {commitSearch ? 'No commits match your search' : 'No commits found'}
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredCommits.map((commit) => (
                      <button
                        key={commit.hash}
                        type="button"
                        onClick={() => setSelectedCommit(commit)}
                        className={`
                          flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors
                          ${selectedCommit?.hash === commit.hash 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-muted/50'
                          }
                        `}
                      >
                        <GitCommit className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-medium">{commit.shortHash}</code>
                            {selectedCommit?.hash === commit.hash && (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <p className="truncate text-sm">{commit.message}</p>
                          <p className="text-xs text-muted-foreground">{commit.author}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {selectedCommit && (
                <p className="text-xs text-muted-foreground">
                  Selected: <code className="font-medium">{selectedCommit.shortHash}</code> - {selectedCommit.message.slice(0, 50)}{selectedCommit.message.length > 50 ? '...' : ''}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Startup Script (optional)</Label>
            <Textarea
              placeholder="#!/bin/bash&#10;npm install&#10;npm run dev"
              value={startupScript}
              onChange={(e) => setStartupScript(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This script will run once when the worktree is created.
            </p>
          </div>

          {startupScript.trim() && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Execute on creation</Label>
                <p className="text-xs text-muted-foreground">
                  Run the startup script immediately after creating the worktree
                </p>
              </div>
              <Switch checked={executeScript} onCheckedChange={setExecuteScript} />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Worktree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
