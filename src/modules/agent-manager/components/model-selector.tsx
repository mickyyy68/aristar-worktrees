import { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { Button, Input, ScrollArea } from '@core/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@core/ui/dropdown-menu';
import { cn } from '@core/lib/utils';
import type { OpenCodeProvider, ModelSelection } from '../store/types';

interface ModelSelectorProps {
  providers: OpenCodeProvider[];
  selectedModels: ModelSelection[];
  onChange: (models: ModelSelection[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  max?: number;
}

export function ModelSelector({
  providers,
  selectedModels,
  onChange,
  isLoading = false,
  disabled = false,
  max,
}: ModelSelectorProps) {
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

  const isSelected = (providerId: string, modelId: string) =>
    selectedModels.some(
      (m) => m.providerId === providerId && m.modelId === modelId
    );

  const toggleModel = (providerId: string, modelId: string) => {
    if (isSelected(providerId, modelId)) {
      onChange(
        selectedModels.filter(
          (m) => !(m.providerId === providerId && m.modelId === modelId)
        )
      );
    } else {
      if (max && selectedModels.length >= max) return;
      onChange([...selectedModels, { providerId, modelId }]);
    }
    searchInputRef.current?.focus();
  };

  const handleRemove = (index: number) => {
    onChange(selectedModels.filter((_, i) => i !== index));
  };

  const clearSearch = () => {
    setSearch('');
    searchInputRef.current?.focus();
  };

  const getSelectedLabel = () => {
    if (selectedModels.length === 0) return 'Add model...';
    if (selectedModels.length === 1) {
      const model = selectedModels[0];
      const provider = providers.find((p) => p.id === model.providerId);
      const modelInfo = provider?.models.find((m) => m.id === model.modelId);
      return modelInfo?.name || model.modelId;
    }
    return `${selectedModels.length} model${selectedModels.length > 1 ? 's' : ''}`;
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{getSelectedLabel()}</span>
          <ChevronDown
            className={cn(
              'ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform',
              open && 'rotate-180'
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-0" align="start">
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
        <ScrollArea className="h-[240px]">
          {selectedModels.length > 0 && (
            <div className="border-b p-2">
              <div className="flex flex-wrap gap-1">
                {selectedModels.map((model, index) => (
                  <span
                    key={`${model.providerId}-${model.modelId}-${index}`}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px]"
                  >
                    {model.modelId}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(index);
                      }}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {filteredProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-xs text-muted-foreground">
                {providers.length === 0
                  ? 'No models available'
                  : 'No models match'}
              </p>
            </div>
          ) : (
            <>
              {!search && providers.reduce((acc, p) => acc + p.models.length, 0) > 20 && (
                <div className="border-b px-2 py-1 text-[10px] text-muted-foreground">
                  Showing 20 of {providers.reduce((acc, p) => acc + p.models.length, 0)}. Search to find more.
                </div>
              )}
              <div className="p-1">
                {filteredProviders.map((provider) => (
                  <div key={provider.id} className="mb-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {provider.name}
                    </div>
                    {provider.models.map((model) => {
                      const selected = isSelected(provider.id, model.id);
                      return (
                        <button
                          key={`${provider.id}/${model.id}`}
                          onClick={() => toggleModel(provider.id, model.id)}
                          disabled={Boolean(max && !selected && selectedModels.length >= max)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                            selected
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            )}
                          >
                            {selected && <Check className="h-2.5 w-2.5" />}
                          </div>
                          <span className="flex-1 truncate">{model.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
