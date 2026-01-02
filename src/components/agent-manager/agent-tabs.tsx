import { Star, AlertTriangle } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusDot } from '@/components/agent-manager/status-badge';
import { cn } from '@/lib/utils';
import type { TaskAgent } from '@/store/types';

interface AgentTabsProps {
  agents: TaskAgent[];
  activeAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  orphanedAgentIds?: string[];
}

export function AgentTabs({
  agents,
  activeAgentId,
  onSelectAgent,
  orphanedAgentIds = [],
}: AgentTabsProps) {
  if (agents.length === 0) {
    return (
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">
        No agents configured
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="border-b">
        <ScrollArea className="w-full">
          <div className="flex gap-1 p-2">
            {agents.map((agent) => {
              const isOrphaned = orphanedAgentIds.includes(agent.id);
              
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    activeAgentId === agent.id
                      ? 'bg-primary text-primary-foreground'
                      : isOrphaned
                        ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {isOrphaned ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Worktree missing - click to recreate</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <StatusDot status={agent.status} size="sm" />
                  )}
                  <span>{agent.modelId}</span>
                  {agent.accepted && (
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  )}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
