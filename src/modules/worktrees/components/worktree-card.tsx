'use client';

import { useState } from 'react';
import {
  GitBranch,
  Terminal,
  Code2,
  FolderOpen,
  MoreHorizontal,
  Copy,
  Lock,
  Unlock,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '@core/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@core/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@core/ui/tooltip';
import { useAppStore } from '@/store/use-app-store';
import type { WorktreeMetadata } from '@/store/types';
import { getBranchColorIndex, getBranchColorStyle } from '../lib/branch-colors';
import { cn } from '@core/lib/utils';

interface WorktreeCardProps {
  worktree: WorktreeMetadata;
  onRename: (worktree: WorktreeMetadata) => void;
  onDelete: (worktree: WorktreeMetadata) => void;
  onLock: (worktree: WorktreeMetadata) => void;
  onUnlock: (worktree: WorktreeMetadata) => void;
}

export function WorktreeCard({
  worktree,
  onRename,
  onDelete,
  onLock,
  onUnlock,
}: WorktreeCardProps) {
  const { openInTerminal, openInEditor, revealInFinder, copyToClipboard } = useAppStore();
  const [copied, setCopied] = useState(false);
  
  const colorIndex = getBranchColorIndex(worktree.branch);
  const colorStyle = getBranchColorStyle(colorIndex, worktree.isMain);

  const handleCopy = async () => {
    await copyToClipboard(worktree.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "group relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:shadow-sm",
      worktree.isLocked && "border-destructive/30 bg-destructive/5"
    )}>
      {/* Branch icon */}
      <div 
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={colorStyle.iconBg}
      >
        <GitBranch 
          className="h-4 w-4"
          style={colorStyle.iconText} 
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{worktree.name}</h3>
          {worktree.isMain && (
            <span 
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ ...colorStyle.badgeBg, ...colorStyle.badgeText }}
            >
              Main
            </span>
          )}
          {worktree.isLocked && (
            <Lock className="h-3 w-3 shrink-0 text-destructive" />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {worktree.branch || `${worktree.commit?.slice(0, 7)}`}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openInTerminal(worktree.path)}
            >
              <Terminal className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Terminal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openInEditor(worktree.path)}
            >
              <Code2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Editor</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => revealInFinder(worktree.path)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Reveal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Path'}
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {worktree.isLocked ? (
              <DropdownMenuItem onClick={() => onUnlock(worktree)}>
                <Unlock className="mr-2 h-4 w-4" />
                Unlock
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onLock(worktree)}>
                <Lock className="mr-2 h-4 w-4" />
                Lock
              </DropdownMenuItem>
            )}
            
            {!worktree.isMain && (
              <>
                <DropdownMenuItem onClick={() => onRename(worktree)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(worktree)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
