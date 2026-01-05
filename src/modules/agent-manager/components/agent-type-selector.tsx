import { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { Button, Input, ScrollArea } from '@core/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@core/ui/dropdown-menu';
import { cn } from '@core/lib/utils';
import type { OpenCodeAgentConfig } from '../store/types';

interface AgentTypeSelectorProps {
  agents: OpenCodeAgentConfig[];
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AgentTypeSelector({
  agents,
  value,
  onChange,
  isLoading = false,
  disabled = false,
}: AgentTypeSelectorProps) {
  const selectedValue = typeof value === 'string' ? value : '';
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    }
  }, [open]);

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const query = search.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.id?.toLowerCase().includes(query) ||
        (agent.description && agent.description.toLowerCase().includes(query))
    );
  }, [agents, search]);

  const getSelectedLabel = () => {
    if (!selectedValue) return 'Select agent type...';
    const selected = agents.find((a) => a.id === selectedValue);
    return selected?.name || selectedValue;
  };

  const handleSelect = (agentId: string) => {
    onChange(agentId);
    setOpen(false);
    setSearch('');
    searchInputRef.current?.focus();
  };

  const clearSearch = () => {
    setSearch('');
    searchInputRef.current?.focus();
  };

  if (isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading agents...
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
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[240px]">
          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-xs text-muted-foreground">{agents.length === 0 ? 'No agents available' : 'No agents match'}</p>
            </div>
          ) : (
            <div className="p-2">
              {['primary', 'subagent'].map((mode) => {
                const modeAgents = filteredAgents.filter((a) => a.mode === mode);
                if (modeAgents.length === 0) return null;
                return (
                  <div key={mode} className="mb-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {mode === 'primary' ? 'Primary' : 'Subagent'}
                    </div>
                    {modeAgents.map((agent) => {
                      const selected = selectedValue === agent.id;
                      return (
                        <button
                          key={agent.id}
                          onClick={() => handleSelect(agent.id)}
                          className={cn(
                            'group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all',
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
                                : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
                            )}
                          >
                            {selected && <Check className="h-2.5 w-2.5" />}
                          </div>
                          <span className="flex-1 truncate text-xs">{agent.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
