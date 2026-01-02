import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OpenCodeAgentConfig } from '@/store/types';

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
  // Filter to only show primary agents (not subagents)
  const primaryAgents = agents.filter(
    (agent) => agent.mode === 'primary' || agent.mode === 'all'
  );

  if (isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading agents...
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select agent type" />
      </SelectTrigger>
      <SelectContent>
        {primaryAgents.length === 0 ? (
          <div className="p-2 text-center text-sm text-muted-foreground">
            No agents available
          </div>
        ) : (
          primaryAgents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex flex-col">
                <span>{agent.name}</span>
                {agent.description && (
                  <span className="text-xs text-muted-foreground">
                    {agent.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
