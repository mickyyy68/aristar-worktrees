import { useState } from 'react';
import { FolderGit2, Plus, RefreshCw, Settings, Bot, ChevronDown } from 'lucide-react';
import { Button } from '@core/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@core/ui/dropdown-menu';
import { ThemeToggle } from './theme-toggle';
import { SettingsDialog } from './settings-dialog';
import { useAppStore } from '@/store/use-app-store';
import { useAgentManagerStore } from '@agent-manager/store';
import { getRepositoryName, cn } from '@core/lib/utils';
import type { ActiveView } from '@/store/types';

interface HeaderProps {
  onAddRepository: () => void;
}

export function Header({ onAddRepository }: HeaderProps) {
  const {
    selectedRepositoryId,
    repositories,
    refreshRepository,
    activeView,
    setActiveView,
    setSelectedRepository,
  } = useAppStore();
  const { loadTasks } = useAgentManagerStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const selectedRepo = repositories.find(r => r.id === selectedRepositoryId);

  const handleViewChange = async (view: ActiveView) => {
    setActiveView(view);
    if (view === 'agent-manager') {
      await loadTasks();
    }
  };

  return (
    <header className="border-b bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Aristar Worktrees" className="h-9 w-9" />
            <div>
              <h1 className="text-lg font-semibold">Aristar Worktrees</h1>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-1">
            <button
              onClick={() => handleViewChange('worktrees')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'worktrees'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FolderGit2 className="h-4 w-4" />
              Worktrees
            </button>
            <button
              onClick={() => handleViewChange('agent-manager')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'agent-manager'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Bot className="h-4 w-4" />
              Agent Manager
            </button>
          </div>

          {/* Repository Selector (Agent Manager view only) */}
          {activeView === 'agent-manager' && repositories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FolderGit2 className="h-4 w-4" />
                  {selectedRepo ? getRepositoryName(selectedRepo.path) : 'Select Repository'}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {repositories.map((repo) => (
                  <DropdownMenuItem
                    key={repo.id}
                    onClick={() => setSelectedRepository(repo.id)}
                    className={cn(
                      repo.id === selectedRepositoryId && 'bg-accent'
                    )}
                  >
                    {getRepositoryName(repo.path)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeView === 'worktrees' && selectedRepositoryId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refreshRepository(selectedRepositoryId)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {activeView === 'worktrees' && (
            <Button onClick={onAddRepository} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Repository
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
