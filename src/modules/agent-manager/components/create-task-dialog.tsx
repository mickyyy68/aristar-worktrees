import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Input } from '@core/ui/input';
import { Textarea } from '@core/ui/textarea';
import { Label } from '@core/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ModelSelector, SelectedModelsList } from './model-selector';
import { AgentTypeSelector } from './agent-type-selector';
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
    refreshOpenCodeData,
    isLoadingOpenCodeData,
  } = useAgentManagerStore();

  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('current-branch');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>([]);
  const [agentType, setAgentType] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRepo = repositories.find((r) => r.id === selectedRepositoryId);

  // Load providers when dialog opens and we have a selected repo
  const loadOpenCodeData = useCallback(async () => {
    if (!selectedRepo) return;

    setLoadingProviders(true);
    try {
      // Start a temporary OpenCode server to fetch providers/agents
      const port = await commands.startOpencode(selectedRepo.path);
      opencodeClient.connect(port);

      // Load providers and agents - they now return the data directly
      await loadProviders(port);
      const agents = await loadAvailableAgents(port);

      // Always set default to first valid agent (agentType was reset to '' on dialog open)
      if (agents.length > 0 && !agentType) {
        // Find 'coder' or use first available
        const defaultAgent = agents.find(a => a.id === 'coder') || agents[0];
        setAgentType(defaultAgent.id);
      }
    } catch (err) {
      console.error('Failed to load OpenCode data:', err);
      const errorMsg = String(err);
      if (errorMsg.includes('not found') || errorMsg.includes('No such file')) {
        setError('OpenCode binary not found. Please install OpenCode from https://opencode.ai');
      } else {
        setError('Failed to load models. Make sure OpenCode is installed.');
      }
    } finally {
      setLoadingProviders(false);
    }
  }, [selectedRepo, loadProviders, loadAvailableAgents]);

  useEffect(() => {
    // Always load when dialog opens with a selected repo to get fresh data
    if (open && selectedRepo) {
      loadOpenCodeData();
    }
  }, [open, selectedRepo, loadOpenCodeData]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setPrompt('');
      setSourceType('current-branch');
      setSelectedBranch('');
      setSelectedCommit(null);
      setSelectedModels([]);
      setAgentType('');
      setError(null);
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_-\s]/g, '-');
    setName(sanitized);
  };

  const handleSubmit = async () => {
    if (!selectedRepo) {
      setError('Please select a repository');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a task name');
      return;
    }
    if (!agentType || !availableAgents.some(a => a.id === agentType)) {
      setError('Please select a valid agent type');
      return;
    }
    if (selectedModels.length === 0) {
      setError('Please select at least one model');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter an initial prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine source branch/commit
      let sourceBranch: string | undefined;
      let sourceCommit: string | undefined;

      if (sourceType === 'existing-branch') {
        sourceBranch = selectedBranch;
      } else if (sourceType === 'commit') {
        sourceCommit = selectedCommit?.hash;
      }
      // For 'current-branch', we don't pass either - backend will use current

      // Create the task
      const task = await createTask({
        name: name.trim(),
        sourceType: sourceType === 'commit' ? 'commit' : 'branch',
        sourceBranch,
        sourceCommit,
        sourceRepoPath: selectedRepo.path,
        agentType: agentType,
        models: selectedModels,
      });

      // Start the task with the initial prompt
      await startTask(task.id, prompt.trim());

      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveModel = (model: ModelSelection) => {
    setSelectedModels(
      selectedModels.filter(
        (m) => !(m.providerId === model.providerId && m.modelId === model.modelId)
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a task with multiple AI agents working in parallel
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-6 overflow-hidden py-4">
          {/* Repository selector (if multiple repos) */}
          {repositories.length > 1 && (
            <div className="min-w-0 space-y-2">
              <Label>Repository</Label>
              <Select
                value={selectedRepositoryId || ''}
                onValueChange={setSelectedRepository}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
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

          {/* Task name */}
          <div className="min-w-0 space-y-2">
            <Label htmlFor="task-name">Task Name</Label>
            <Input
              id="task-name"
              placeholder="e.g., Refactor Authentication"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

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
            />
          )}

          {/* Agent type selector */}
          <div className="min-w-0 space-y-2">
            <Label>Agent Type</Label>
            <AgentTypeSelector
              agents={availableAgents}
              value={agentType}
              onChange={setAgentType}
              isLoading={loadingProviders}
            />
          </div>

          {/* Model selector */}
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Models</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => selectedRepo && refreshOpenCodeData(selectedRepo.path)}
                disabled={loadingProviders || isLoadingOpenCodeData || !selectedRepo}
                className="h-7 px-2 text-xs"
              >
                {isLoadingOpenCodeData ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Refresh
              </Button>
            </div>
            <ModelSelector
              providers={providers}
              selectedModels={selectedModels}
              onChange={setSelectedModels}
              isLoading={loadingProviders || isLoadingOpenCodeData}
            />
            <div className="min-w-0">
              <SelectedModelsList
                providers={providers}
                selectedModels={selectedModels}
                onRemove={handleRemoveModel}
              />
            </div>
          </div>

          {/* Initial prompt */}
          <div className="min-w-0 space-y-2">
            <Label htmlFor="prompt">Initial Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe what you want the agents to do..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              !name.trim() ||
              !agentType ||
              selectedModels.length === 0 ||
              !prompt.trim() ||
              !selectedRepo
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create & Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
