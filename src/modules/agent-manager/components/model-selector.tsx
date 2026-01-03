import { useState, useMemo, useRef } from 'react';
import { Check, ChevronDown, Search, Loader2 } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Input } from '@core/ui/input';
import { ScrollArea } from '@core/ui/scroll-area';
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
}

export function ModelSelector({
  providers,
  selectedModels,
  onChange,
  isLoading = false,
  disabled = false,
}: ModelSelectorProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter providers/models based on search
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

  const isSelected = (providerId: string, modelId: string) => {
    return selectedModels.some(
      (m) => m.providerId === providerId && m.modelId === modelId
    );
  };

  const toggleModel = (providerId: string, modelId: string) => {
    if (isSelected(providerId, modelId)) {
      onChange(
        selectedModels.filter(
          (m) => !(m.providerId === providerId && m.modelId === modelId)
        )
      );
    } else {
      onChange([...selectedModels, { providerId, modelId }]);
    }
    searchInputRef.current?.focus();
  };

  const getSelectedLabel = () => {
    if (selectedModels.length === 0) return 'Select models...';
    if (selectedModels.length === 1) {
      const model = selectedModels[0];
      const provider = providers.find((p) => p.id === model.providerId);
      const modelInfo = provider?.models.find((m) => m.id === model.modelId);
      return modelInfo?.name || model.modelId;
    }
    return `${selectedModels.length} models selected`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading models...
            </>
          ) : (
            <>
              <span className="truncate">{getSelectedLabel()}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {filteredProviders.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {providers.length === 0
                ? 'No providers available'
                : 'No models match your search'}
            </div>
          ) : (
            <div className="p-1">
              {filteredProviders.map((provider) => (
                <div key={provider.id} className="mb-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {provider.name}
                  </div>
                  {provider.models.map((model) => {
                    const selected = isSelected(provider.id, model.id);
                    return (
                      <button
                        key={`${provider.id}/${model.id}`}
                        onClick={() => toggleModel(provider.id, model.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                          selected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="flex-1 truncate">{model.name}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {selectedModels.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => onChange([])}
            >
              Clear selection
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact display of selected models
interface SelectedModelsListProps {
  providers: OpenCodeProvider[];
  selectedModels: ModelSelection[];
  onRemove: (model: ModelSelection) => void;
}

export function SelectedModelsList({
  providers,
  selectedModels,
  onRemove,
}: SelectedModelsListProps) {
  if (selectedModels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {selectedModels.map((selection) => {
        const provider = providers.find((p) => p.id === selection.providerId);
        const model = provider?.models.find((m) => m.id === selection.modelId);
        const displayName = model?.name || selection.modelId;

        return (
          <span
            key={`${selection.providerId}/${selection.modelId}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {displayName}
            <button
              onClick={() => onRemove(selection)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
            >
              <span className="sr-only">Remove {displayName}</span>
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        );
      })}
    </div>
  );
}
