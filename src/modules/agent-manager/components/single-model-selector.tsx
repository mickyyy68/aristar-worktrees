/**
 * Single Model Selector
 *
 * A simplified model selector for selecting exactly one model.
 * Used in settings for optimization model configuration.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { Button, Input, ScrollArea } from '@core/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@core/ui/dropdown-menu';
import { cn } from '@core/lib/utils';
import type { OpenCodeProvider } from '../store/types';
import type { OptimizationModelSelection } from '@/store/types';

interface SingleModelSelectorProps {
  providers: OpenCodeProvider[];
  selectedModel: OptimizationModelSelection | undefined;
  onChange: (model: OptimizationModelSelection | undefined) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function SingleModelSelector({
  providers,
  selectedModel,
  onChange,
  isLoading = false,
  disabled = false,
  placeholder = 'Select model...',
}: SingleModelSelectorProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    }
  }, [open]);

  const filteredProviders = useMemo(() => {
    if (!search.trim()) return providers;
    const query = search.toLowerCase();
    return providers
      .map((provider) => ({
        ...provider,
        models: provider.models.filter(
          (model) =>
            model.name.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query) ||
            provider.name.toLowerCase().includes(query)
        ),
      }))
      .filter((provider) => provider.models.length > 0);
  }, [providers, search]);

  const selectModel = (providerId: string, modelId: string) => {
    onChange({ providerId, modelId });
    setOpen(false);
    setSearch('');
  };

  const clearSelection = () => {
    onChange(undefined);
  };

  const clearSearch = () => {
    setSearch('');
    searchInputRef.current?.focus();
  };

  const getSelectedLabel = (): string => {
    if (!selectedModel) return placeholder;

    const provider = providers.find((p) => p.id === selectedModel.providerId);
    const model = provider?.models.find((m) => m.id === selectedModel.modelId);
    
    if (model) {
      return `${provider?.name || selectedModel.providerId} / ${model.name}`;
    }
    return `${selectedModel.providerId}/${selectedModel.modelId}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex-1 justify-between"
            disabled={disabled}
          >
            <span className={cn('truncate', !selectedModel && 'text-muted-foreground')}>
              {getSelectedLabel()}
            </span>
            <ChevronDown
              className={cn(
                'ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform',
                open && 'rotate-180'
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-0" align="start">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs"
              />
              {search && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="h-[280px]">
            {filteredProviders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {providers.length === 0
                    ? 'No models available'
                    : 'No models match your search'}
                </p>
                {providers.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Make sure OpenCode is running
                  </p>
                )}
              </div>
            ) : (
              <div className="p-1">
                {filteredProviders.map((provider) => (
                  <div key={provider.id} className="mb-1">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {provider.name}
                    </div>
                    {provider.models.map((model) => {
                      const isSelected =
                        selectedModel?.providerId === provider.id &&
                        selectedModel?.modelId === model.id;
                      return (
                        <button
                          key={`${provider.id}/${model.id}`}
                          onClick={() => selectModel(provider.id, model.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{model.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate font-mono">
                              {model.id}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedModel && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={clearSelection}
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
