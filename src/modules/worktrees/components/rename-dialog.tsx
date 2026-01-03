'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Input } from '@core/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@core/ui/dialog';
import { Label } from '@core/ui/label';
import { useAppStore } from '@/store/use-app-store';
import type { WorktreeMetadata } from '@/store/types';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktree: WorktreeMetadata | null;
}

export function RenameDialog({ open, onOpenChange, worktree }: RenameDialogProps) {
  const { renameWorktree } = useAppStore();
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNewName('');
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!worktree || !newName.trim()) {
      setError('Please enter a new name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sanitizedName = newName.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
      await renameWorktree(worktree.path, sanitizedName);
      handleOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-[400px]">
        <DialogHeader>
          <DialogTitle>Rename Worktree</DialogTitle>
          <DialogDescription>
            Rename "{worktree?.name}" to a new name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">New Name</Label>
            <Input
              id="new-name"
              placeholder="feature/my-feature"
              value={newName}
              onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '-'))}
            />
            <p className="text-xs text-muted-foreground">
              Only alphanumeric characters, hyphens, and underscores are allowed.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !newName.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
