import { Star } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { StatusDot } from '@/components/agent-manager/status-badge';
import { cn } from '@/lib/utils';
import type { TaskAgent } from '@/store/types';

interface AgentTabsProps {
  agents: TaskAgent[];
  activeAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}

export function AgentTabs({
  agents,
  activeAgentId,
  onSelectAgent,
}: AgentTabsProps) {
  if (agents.length === 0) {
    return (
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">
        No agents configured
      </div>
    );
  }

  return (
    <div className="border-b">
      <ScrollArea className="w-full">
        <div className="flex gap-1 p-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                activeAgentId === agent.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <StatusDot
                status={agent.status}
                size="sm"
              />
              <span>{agent.modelId}</span>
              {agent.accepted && (
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              )}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
