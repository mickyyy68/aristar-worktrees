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
import type { BranchInfo, CommitInfo, SourceType } from '@/store/types';

interface SourceSelectorProps {
  repoPath: string;
  sourceType: SourceType;
  onSourceTypeChange: (type: SourceType) => void;
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
  selectedCommit: CommitInfo | null;
  onCommitChange: (commit: CommitInfo | null) => void;
}

export function SourceSelector({
  repoPath,
  sourceType,
  onSourceTypeChange,
  selectedBranch,
  onBranchChange,
  selectedCommit,
  onCommitChange,
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Source</Label>
        <Select
          value={sourceType}
          onValueChange={(v) => onSourceTypeChange(v as SourceType)}
        >
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
          {loadingBranches ? (
            <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading branches...
            </div>
          ) : (
            <Select value={selectedBranch} onValueChange={onBranchChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {localBranches.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      {branch.name}
                      {branch.isCurrent && (
                        <span className="text-xs text-muted-foreground">
                          (current)
                        </span>
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
                {commitSearch
                  ? 'No commits match your search'
                  : 'No commits found'}
              </div>
            ) : (
              <div className="p-1">
                {filteredCommits.map((commit) => (
                  <button
                    key={commit.hash}
                    type="button"
                    onClick={() => onCommitChange(commit)}
                    className={`
                      flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors
                      ${
                        selectedCommit?.hash === commit.hash
                          ? 'bg-primary/15'
                          : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <GitCommit
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        selectedCommit?.hash === commit.hash
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code
                          className={`
                            shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold
                            ${
                              selectedCommit?.hash === commit.hash
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted/50 text-foreground'
                            }
                          `}
                        >
                          {commit.shortHash || commit.hash?.slice(0, 7) || '???????'}
                        </code>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {commit.message}
                        </span>
                        {selectedCommit?.hash === commit.hash && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {commit.author}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          {selectedCommit && (
            <p className="text-xs text-muted-foreground">
              Selected:{' '}
              <code className="font-medium">{selectedCommit.shortHash}</code> -{' '}
              {selectedCommit.message.slice(0, 50)}
              {selectedCommit.message.length > 50 ? '...' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
