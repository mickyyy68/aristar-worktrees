import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Input } from '@core/ui/input';
import { Textarea } from '@core/ui/textarea';
import { Label } from '@core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@core/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui/select';
import { SourceSelector } from './source-selector';
import { AgentTypeSelector } from './agent-type-selector';
import { ModelSelector } from './model-selector';
import { useAppStore } from '@/store/use-app-store';
import { useAgentManagerStore } from '../store/agent-manager-store';
import { opencodeClient } from '../api/opencode';
import { commands } from '@core/lib';
import type { CommitInfo, SourceType } from '@/store/types';
import type { ModelSelection } from '../store/types';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const { repositories, selectedRepositoryId, setSelectedRepository } = useAppStore();
  const {
    createTask,
    startTask,
    providers,
    availableAgents,
    loadProviders,
    loadAvailableAgents,
    taskPreferences,
    saveTaskPreferences,
    clearTaskPreferences,
  } = useAgentManagerStore();

  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('current-branch');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>([]);
  const [agentType, setAgentType] = useState('build');
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRepo = repositories.find((r) => r.id === selectedRepositoryId);

  // Load providers when dialog opens
  const loadOpenCodeData = useCallback(async () => {
    if (!selectedRepo) return;

    setLoadingProviders(true);
    try {
      const port = await commands.startOpencode(selectedRepo.path);
      opencodeClient.connect(port);

      await loadProviders(port);
      await loadAvailableAgents(port);
    } catch (err) {
      console.error('Failed to load OpenCode data:', err);
      const errorMsg = String(err);
      if (errorMsg.includes('not found') || errorMsg.includes('No such file')) {
        setError('OpenCode not found. Install from https://opencode.ai');
      } else {
        setError('Failed to load models');
      }
    } finally {
      setLoadingProviders(false);
    }
  }, [selectedRepo, loadProviders, loadAvailableAgents]);

  useEffect(() => {
    if (open && selectedRepo) {
      loadOpenCodeData();
    }
  }, [open, selectedRepo, loadOpenCodeData]);

  // Reset form when dialog opens and load saved preferences
  useEffect(() => {
    if (open) {
      setName('');
      setSourceType('current-branch');
      setSelectedBranch('');
      setSelectedCommit(null);
      setError(null);
      
      // Load saved preferences for this repository
      const prefs = selectedRepositoryId ? taskPreferences[selectedRepositoryId] : null;
      setAgentType(prefs?.agentType || 'build');
      setSelectedModels(prefs?.models || []);
      setPrompt(prefs?.prompt || '');
    }
  }, [open, selectedRepositoryId, taskPreferences]);

  const handleNameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_-\s]/g, '-');
    setName(sanitized);
  };

  const handleSubmit = async () => {
    if (!selectedRepo) {
      setError('Select a repository');
      return;
    }
    if (!name.trim()) {
      setError('Enter a task name');
      return;
    }
    if (selectedModels.length === 0) {
      setError('Select at least one model');
      return;
    }
    if (!prompt.trim()) {
      setError('Enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save preferences for this repository
      if (selectedRepositoryId) {
        saveTaskPreferences(selectedRepositoryId, agentType, selectedModels, prompt);
      }

      let sourceBranch: string | undefined;
      let sourceCommit: string | undefined;

      if (sourceType === 'existing-branch') {
        sourceBranch = selectedBranch;
      } else if (sourceType === 'commit') {
        sourceCommit = selectedCommit?.hash;
      }

      const task = await createTask({
        name: name.trim(),
        sourceType: sourceType === 'commit' ? 'commit' : 'branch',
        sourceBranch,
        sourceCommit,
        sourceRepoPath: selectedRepo.path,
        agentType: agentType || 'coder',
        models: selectedModels,
      });

      await startTask(task.id, prompt.trim());
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClearPreferences = () => {
    if (selectedRepositoryId) {
      clearTaskPreferences(selectedRepositoryId);
      // Reset form fields to defaults
      setAgentType('build');
      setSelectedModels([]);
      setPrompt('');
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-4">
          {/* Task name */}
          <div className="space-y-1.5">
            <Label htmlFor="task-name" className="text-xs text-muted-foreground">Name</Label>
            <Input
              id="task-name"
              placeholder="e.g., Refactor authentication"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Repository selector */}
          {repositories.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Repository</Label>
              <Select
                value={selectedRepositoryId || ''}
                onValueChange={setSelectedRepository}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select repository" />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Source selector */}
          {selectedRepo && (
            <SourceSelector
              repoPath={selectedRepo.path}
              sourceType={sourceType}
              onSourceTypeChange={setSourceType}
              selectedBranch={selectedBranch}
              onBranchChange={setSelectedBranch}
              selectedCommit={selectedCommit}
              onCommitChange={setSelectedCommit}
              compact
            />
          )}

          {/* Agent type and Models selectors */}
          <div className="grid grid-cols-2 gap-4">
            {/* Agent type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Agent Type</Label>
              <AgentTypeSelector
                agents={availableAgents}
                value={agentType}
                onChange={setAgentType}
                isLoading={loadingProviders}
              />
            </div>

            {/* Models selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Models</Label>
              <ModelSelector
                providers={providers}
                selectedModels={selectedModels}
                onChange={setSelectedModels}
                isLoading={loadingProviders}
              />
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="prompt" className="text-xs text-muted-foreground">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe what you want the agents to do..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <div className="flex w-full items-center justify-between">
            {selectedRepositoryId && taskPreferences[selectedRepositoryId] ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleClearPreferences}
              >
                Clear saved preferences
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !name.trim() || selectedModels.length === 0 || !prompt.trim()}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
