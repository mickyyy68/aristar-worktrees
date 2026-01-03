import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, GitCommit, GitBranch, Check, Loader2 } from 'lucide-react';
import { Input } from '@core/ui/input';
import { Label } from '@core/ui/label';
import { ScrollArea } from '@core/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui/select';
import { commands } from '@core/lib';
import { cn } from '@core/lib/utils';
import type { BranchInfo, CommitInfo, SourceType } from '@/store/types';

interface SourceSelectorProps {
  repoPath: string;
  sourceType: SourceType;
  onSourceTypeChange: (type: SourceType) => void;
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
  selectedCommit: CommitInfo | null;
  onCommitChange: (commit: CommitInfo | null) => void;
  /** Compact mode with smaller labels */
  compact?: boolean;
}

export function SourceSelector({
  repoPath,
  sourceType,
  onSourceTypeChange,
  selectedBranch,
  onBranchChange,
  selectedCommit,
  onCommitChange,
  compact = false,
}: SourceSelectorProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [commitSearch, setCommitSearch] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingCommits, setLoadingCommits] = useState(false);

  const loadBranches = useCallback(async () => {
    if (!repoPath) return;
    setLoadingBranches(true);
    try {
      const branchList = await commands.getBranches(repoPath);
      setBranches(branchList);
      const currentBranch = branchList.find((b) => b.isCurrent);
      if (currentBranch && !selectedBranch) {
        onBranchChange(currentBranch.name);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoadingBranches(false);
    }
  }, [repoPath, selectedBranch, onBranchChange]);

  const loadCommits = useCallback(async () => {
    if (!repoPath) return;
    setLoadingCommits(true);
    try {
      const commitList = await commands.getCommits(repoPath, 50);
      setCommits(commitList);
    } catch (err) {
      console.error('Failed to load commits:', err);
    } finally {
      setLoadingCommits(false);
    }
  }, [repoPath]);

  useEffect(() => {
    if (repoPath) {
      loadBranches();
    }
  }, [repoPath, loadBranches]);

  useEffect(() => {
    if (sourceType === 'commit' && commits.length === 0 && repoPath) {
      loadCommits();
    }
  }, [sourceType, commits.length, repoPath, loadCommits]);

  const filteredCommits = useMemo(() => {
    if (!commitSearch.trim()) return commits;
    const search = commitSearch.toLowerCase();
    return commits.filter(
      (c) =>
        c.shortHash.toLowerCase().includes(search) ||
        c.hash.toLowerCase().includes(search) ||
        c.message.toLowerCase().includes(search) ||
        c.author.toLowerCase().includes(search)
    );
  }, [commits, commitSearch]);

  const localBranches = branches.filter((b) => !b.isRemote);
  const labelClass = compact ? 'text-xs text-muted-foreground' : '';
  const inputHeight = compact ? 'h-9' : '';

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className={labelClass}>Source</Label>
        <Select
          value={sourceType}
          onValueChange={(v) => onSourceTypeChange(v as SourceType)}
        >
          <SelectTrigger className={inputHeight}>
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
        <div className="space-y-1.5">
          <Label className={labelClass}>Branch</Label>
          {loadingBranches ? (
            <div className={cn(
              "flex items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground",
              compact ? "h-9" : "h-10"
            )}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <Select value={selectedBranch} onValueChange={onBranchChange}>
              <SelectTrigger className={inputHeight}>
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {localBranches.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span>{branch.name}</span>
                      {branch.isCurrent && (
                        <span className="text-xs text-muted-foreground">(current)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {sourceType === 'commit' && (
        <div className="space-y-1.5">
          <Label className={labelClass}>Commit</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search commits..."
              value={commitSearch}
              onChange={(e) => setCommitSearch(e.target.value)}
              className={cn("pl-8", inputHeight)}
            />
          </div>
          <ScrollArea className="h-[140px] rounded-md border">
            {loadingCommits ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCommits.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {commitSearch ? 'No matches' : 'No commits'}
              </div>
            ) : (
              <div className="p-1">
                {filteredCommits.map((commit) => (
                  <button
                    key={commit.hash}
                    type="button"
                    onClick={() => onCommitChange(commit)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors',
                      selectedCommit?.hash === commit.hash
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <GitCommit className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      selectedCommit?.hash === commit.hash ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <code className={cn(
                          'shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-medium',
                          selectedCommit?.hash === commit.hash
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-foreground'
                        )}>
                          {commit.shortHash || commit.hash?.slice(0, 7)}
                        </code>
                        <span className="truncate text-xs">{commit.message}</span>
                        {selectedCommit?.hash === commit.hash && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          {selectedCommit && (
            <p className="text-[10px] text-muted-foreground">
              Selected: <code className="font-medium">{selectedCommit.shortHash}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
