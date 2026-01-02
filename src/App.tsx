import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderGit2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/use-app-store';
import { Header } from '@/components/header';
import { RepositorySidebar } from '@/components/repository-sidebar';
import { WorktreeCard } from '@/components/worktree-card';
import { CreateWorktreeDialog } from '@/components/create-worktree-dialog';
import { RenameDialog } from '@/components/rename-dialog';
import { OpenCodePanel } from '@/components/opencode-panel';
import { isProtectedBranch } from '@/lib/branch-colors';
import type { WorktreeMetadata } from '@/store/types';

function App() {
  const {
    repositories,
    selectedRepositoryId,
    setSelectedRepository,
    addRepository,
    removeRepository,
    removeWorktree,
    lockWorktree,
    unlockWorktree,
    error,
  } = useAppStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [worktreeToRename, setWorktreeToRename] = useState<WorktreeMetadata | null>(null);
  const [worktreeToDelete, setWorktreeToDelete] = useState<WorktreeMetadata | null>(null);
  const [deleteBranch, setDeleteBranch] = useState(true);
  const [repositoryToDelete, setRepositoryToDelete] = useState<string | null>(null);

  const selectedRepo = repositories.find(r => r.id === selectedRepositoryId);

  useEffect(() => {
    useAppStore.getState().loadRepositories();
  }, []);

  const handleAddRepository = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a Git repository',
      });
      if (selected && typeof selected === 'string') {
        await addRepository(selected);
      }
    } catch (err) {
      console.error('Failed to add repository:', err);
    }
  };

  const handleSelectRepository = (id: string) => {
    setSelectedRepository(id);
  };

  const handleRemoveRepository = (id: string) => {
    setRepositoryToDelete(id);
  };

  const confirmDeleteRepository = async () => {
    if (repositoryToDelete) {
      await removeRepository(repositoryToDelete);
      setRepositoryToDelete(null);
    }
  };

  const handleRename = (worktree: WorktreeMetadata) => {
    setWorktreeToRename(worktree);
    setRenameDialogOpen(true);
  };

  const handleDelete = (worktree: WorktreeMetadata) => {
    setWorktreeToDelete(worktree);
  };

  const confirmDelete = async () => {
    if (worktreeToDelete) {
      const force = true;
      const shouldDeleteBranch = deleteBranch && 
        !worktreeToDelete.isMain && 
        !!worktreeToDelete.branch;
      await removeWorktree(worktreeToDelete.path, force, shouldDeleteBranch);
      setWorktreeToDelete(null);
      setDeleteBranch(true); // Reset for next time
    }
  };

  const handleLock = (worktree: WorktreeMetadata) => {
    const reason = prompt('Reason for locking (optional):');
    lockWorktree(worktree.path, reason || undefined);
  };

  const handleUnlock = (worktree: WorktreeMetadata) => {
    unlockWorktree(worktree.path);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header onAddRepository={handleAddRepository} />

      <div className="flex flex-1 overflow-hidden">
        <RepositorySidebar
          onSelectRepository={handleSelectRepository}
          onRemoveRepository={handleRemoveRepository}
        />

        <main className="flex-1 overflow-hidden">
          {selectedRepo ? (
            <div className="flex h-full flex-col">
              <div className="border-b bg-card px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h2 className="font-medium">{selectedRepo.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedRepo.worktrees.length} worktree{selectedRepo.worktrees.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Worktree
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-6">
                {selectedRepo.worktrees.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-4 rounded-full bg-secondary/30 p-4">
                      <FolderGit2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium">No worktrees yet</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Create your first worktree to start managing multiple branches.
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Worktree
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {selectedRepo.worktrees.map((worktree) => (
                      <WorktreeCard
                        key={worktree.id}
                        worktree={worktree}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        onLock={handleLock}
                        onUnlock={handleUnlock}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-6 rounded-full bg-primary/10 p-6">
                <FolderGit2 className="h-12 w-12 text-primary" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">Welcome to Aristar Worktrees</h2>
              <p className="mb-6 max-w-md text-muted-foreground">
                Add a Git repository to start managing your worktrees.
                Create, organize, and navigate between worktrees with ease.
              </p>
              <Button onClick={handleAddRepository} size="lg">
                <FolderGit2 className="mr-2 h-5 w-5" />
                Add Repository
              </Button>
            </div>
          )}
        </main>
      </div>

      {error && (
        <div className="border-t bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <CreateWorktreeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        worktree={worktreeToRename}
      />

      {worktreeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Delete Worktree</h3>
            <p className="mb-4 text-muted-foreground">
              Are you sure you want to delete "{worktreeToDelete.name}"?
              This action cannot be undone.
            </p>
            
            {/* Branch deletion option - only show for non-main worktrees with a branch */}
            {!worktreeToDelete.isMain && worktreeToDelete.branch && (
              <div className="mb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Switch 
                    id="delete-branch" 
                    checked={deleteBranch} 
                    onCheckedChange={setDeleteBranch} 
                  />
                  <Label htmlFor="delete-branch" className="text-sm cursor-pointer">
                    Also delete branch "{worktreeToDelete.branch}"
                  </Label>
                </div>
                
                {/* Warning for protected branches */}
                {deleteBranch && isProtectedBranch(worktreeToDelete.branch) && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Warning: Protected Branch</p>
                      <p className="text-xs opacity-90">
                        "{worktreeToDelete.branch}" is a protected branch. It will not be deleted.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setWorktreeToDelete(null);
                setDeleteBranch(true);
              }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {repositoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Remove Repository</h3>
            <p className="mb-4 text-muted-foreground">
              Are you sure you want to remove this repository from the list?
              This will not delete any files on disk.
            </p>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRepositoryToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteRepository}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      <OpenCodePanel />
    </div>
  );
}

export default App;
