import { useState } from 'react';
import { FolderGit2, Plus, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsDialog } from '@/components/settings-dialog';
import { useAppStore } from '@/store/use-app-store';
import { getRepositoryName } from '@/lib/utils';

interface HeaderProps {
  onAddRepository: () => void;
}

export function Header({ onAddRepository }: HeaderProps) {
  const { selectedRepositoryId, repositories, refreshRepository } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const selectedRepo = repositories.find(r => r.id === selectedRepositoryId);

  return (
    <header className="border-b bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <FolderGit2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Aristar Worktrees</h1>
            {selectedRepo && (
              <p className="text-sm text-muted-foreground">
                {getRepositoryName(selectedRepo.path)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedRepositoryId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refreshRepository(selectedRepositoryId)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={onAddRepository} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Repository
          </Button>
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
