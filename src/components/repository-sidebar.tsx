'use client';

import { useEffect, useState } from 'react';
import { FolderGit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppStore } from '@/store/use-app-store';
import { getRepositoryName, truncatePath } from '@/lib/utils';

interface RepositorySidebarProps {
  onSelectRepository: (id: string) => void;
  onRemoveRepository: (id: string) => void;
}

export function RepositorySidebar({ onSelectRepository, onRemoveRepository }: RepositorySidebarProps) {
  const { repositories, selectedRepositoryId } = useAppStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (repositories.length > 0 && !selectedRepositoryId) {
      onSelectRepository(repositories[0].id);
      setExpandedIds(new Set([repositories[0].id]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelect = (id: string) => {
    onSelectRepository(id);
    if (!expandedIds.has(id)) {
      setExpandedIds(prev => new Set([...prev, id]));
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-sidebar-foreground">Repositories</h2>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-2">
          {repositories.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No repositories added yet.
              <br />
              Click "Add Repository" to get started.
            </p>
          ) : (
            repositories.map((repo) => (
              <div key={repo.id} className="mb-1">
                <div
                  className={`
                    group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer
                    transition-colors
                    ${selectedRepositoryId === repo.id 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}
                  `}
                  onClick={() => handleSelect(repo.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(repo.id);
                    }}
                    className="shrink-0"
                  >
                    {expandedIds.has(repo.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <FolderGit2 className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">
                    {getRepositoryName(repo.path)}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRepository(repo.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Remove repository</TooltipContent>
                  </Tooltip>
                </div>

                {expandedIds.has(repo.id) && (
                  <div className="ml-4 mt-1 border-l border-sidebar-border pl-3">
                    <div className="py-2 text-xs text-muted-foreground">
                      <p className="mb-1 font-medium">Worktrees: {repo.worktrees.length}</p>
                      <p className="truncate" title={repo.path}>
                        {truncatePath(repo.path, 25)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
