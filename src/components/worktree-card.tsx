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
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppStore } from '@/store/use-app-store';
import type { WorktreeMetadata } from '@/store/types';
import { truncatePath } from '@/lib/utils';
import { getBranchColorIndex, getBranchColorStyle } from '@/lib/branch-colors';

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
  
  // Get branch-based color styling
  const colorIndex = getBranchColorIndex(worktree.branch);
  const colorStyle = getBranchColorStyle(colorIndex, worktree.isMain);

  const handleCopy = async () => {
    await copyToClipboard(worktree.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={colorStyle.iconBg}
            >
              <GitBranch 
                className="h-5 w-5"
                style={colorStyle.iconText} 
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate max-w-[180px]">
                  {worktree.name}
                </h3>
                {worktree.isMain && (
                  <span 
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ ...colorStyle.badgeBg, ...colorStyle.badgeText }}
                  >
                    Main
                  </span>
                )}
                {worktree.isLocked && (
                  <Lock className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {worktree.branch || `Commit: ${worktree.commit?.slice(0, 7)}`}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {truncatePath(worktree.path, 30)}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => openInTerminal(worktree.path)}>
                <Terminal className="mr-2 h-4 w-4" />
                Open in Terminal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openInEditor(worktree.path)}>
                <Code2 className="mr-2 h-4 w-4" />
                Open in Editor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => revealInFinder(worktree.path)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Reveal in Finder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy Path'}
              </DropdownMenuItem>
              
              {worktree.startupScript && (
                <DropdownMenuItem>
                  <FileCode className="mr-2 h-4 w-4" />
                  Has startup script
                </DropdownMenuItem>
              )}

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

        <div className="mt-4 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInTerminal(worktree.path)}
                className="flex-1"
              >
                <Terminal className="mr-2 h-3.5 w-3.5" />
                Terminal
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open terminal in worktree</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => revealInFinder(worktree.path)}
                className="flex-1"
              >
                <FolderOpen className="mr-2 h-3.5 w-3.5" />
                Open
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reveal in Finder</TooltipContent>
          </Tooltip>
        </div>

        {worktree.startupScript && !worktree.scriptExecuted && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-accent/50 px-3 py-2">
            <FileCode className="h-4 w-4 text-accent-foreground" />
            <span className="text-xs font-medium">Startup script pending</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
