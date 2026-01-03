import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Plus, X, Search, Check } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Input } from '@core/ui/input';
import { Textarea } from '@core/ui/textarea';
import { Label } from '@core/ui/label';
import { ScrollArea } from '@core/ui/scroll-area';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@core/ui/popover';
import { SourceSelector } from './source-selector';
import { useAppStore } from '@/store/use-app-store';
import { useAgentManagerStore } from '../store/agent-manager-store';
import { opencodeClient } from '../api/opencode';
import { commands } from '@core/lib';
import { cn } from '@core/lib/utils';
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
  } = useAgentManagerStore();
  
  const modelSearchInputRef = useRef<HTMLInputElement>(null);

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
  
  // Search state for models
  const [modelSearch, setModelSearch] = useState('');
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);

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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setPrompt('');
      setSourceType('current-branch');
      setSelectedBranch('');
      setSelectedCommit(null);
      setSelectedModels([]);
      setAgentType('build');
      setError(null);
      setModelSearch('');
    }
  }, [open]);

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

  const handleAddModel = (providerId: string, modelId: string) => {
    const exists = selectedModels.some(
      m => m.providerId === providerId && m.modelId === modelId
    );
    if (!exists) {
      setSelectedModels([...selectedModels, { providerId, modelId }]);
    }
    setModelSearch('');
  };

  const handleRemoveModel = (index: number) => {
    setSelectedModels(selectedModels.filter((_, i) => i !== index));
  };

  // Get all available models from providers
  const availableModels = useMemo(() => {
    return providers.flatMap(p => 
      p.models.map(m => ({
        providerId: p.id,
        providerName: p.name,
        modelId: m.id,
        modelName: m.name,
      }))
    );
  }, [providers]);

  // Filter models by search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return availableModels.slice(0, 20); // Show first 20 by default
    const search = modelSearch.toLowerCase();
    return availableModels.filter(m => 
      m.modelId.toLowerCase().includes(search) ||
      m.modelName.toLowerCase().includes(search) ||
      m.providerName.toLowerCase().includes(search)
    );
  }, [availableModels, modelSearch]);



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

          {/* Agent type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Agent Type</Label>
            <Select value={agentType} onValueChange={setAgentType} disabled={loadingProviders}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select agent type" />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.length === 0 ? (
                  <SelectItem value="build">Build</SelectItem>
                ) : (
                  availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Models with search */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Models</Label>
            <div className="flex flex-wrap gap-1.5">
              {selectedModels.map((model, index) => (
                <span
                  key={`${model.providerId}-${model.modelId}-${index}`}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
                >
                  {model.modelId}
                  <button
                    type="button"
                    onClick={() => handleRemoveModel(index)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 border-dashed px-2 text-xs"
                    disabled={loadingProviders}
                  >
                    {loadingProviders ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Add model
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[320px] p-0" 
                  align="start" 
                  onWheel={(e) => e.stopPropagation()}
                  onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    setTimeout(() => {
                      modelSearchInputRef.current?.focus();
                    }, 0);
                  }}
                >
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={modelSearchInputRef}
                        placeholder="Search models..."
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[240px]" type="always">
                    <div className="p-1">
                      {filteredModels.length === 0 ? (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                          {modelSearch ? 'No models found' : 'No models available'}
                        </div>
                      ) : (
                        <>
                          {!modelSearch && availableModels.length > 20 && (
                            <div className="px-2 py-1 text-[10px] text-muted-foreground">
                              Showing 20 of {availableModels.length} models. Search to find more.
                            </div>
                          )}
                          {filteredModels.map((model) => {
                            const isSelected = selectedModels.some(
                              m => m.providerId === model.providerId && m.modelId === model.modelId
                            );
                            return (
                              <button
                                key={`${model.providerId}::${model.modelId}`}
                                type="button"
                                onClick={() => {
                                  if (!isSelected) {
                                    handleAddModel(model.providerId, model.modelId);
                                  }
                                }}
                                disabled={isSelected}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                                  isSelected
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-muted/50'
                                )}
                              >
                                <span className="text-xs text-muted-foreground">{model.providerName}/</span>
                                <span className="flex-1 truncate">{model.modelName}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
