import { useState, useMemo, useRef } from 'react';
import { Check, ChevronDown, Search, Loader2 } from 'lucide-react';
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
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {filteredAgents.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {agents.length === 0
                ? 'No agents available'
                : 'No agents match your search'}
            </div>
          ) : (
            <div className="p-1">
              {['primary', 'subagent'].map((mode) => {
                const modeAgents = filteredAgents.filter((a) => a.mode === mode);
                if (modeAgents.length === 0) return null;
                return (
                  <div key={mode} className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {mode === 'primary' ? 'Primary' : 'Subagent'}
                    </div>
                    {modeAgents.map((agent) => {
                      const selected = selectedValue === agent.id;
                      return (
                        <button
                          key={agent.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onChange(agent.id);
                            setOpen(false);
                            searchInputRef.current?.focus();
                          }}
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
                          <span className="flex-1 truncate">{agent.name}</span>
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
