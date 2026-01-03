import { Star, AlertTriangle, ThumbsUp } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@core/ui/scroll-area';
import { TooltipProvider } from '@core/ui/tooltip';
import { cn } from '@core/lib/utils';
import type { TaskAgent, AgentStatus } from '../store/types';

interface AgentTabsProps {
  agents: TaskAgent[];
  activeAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  orphanedAgentIds?: string[];
}

function getStatusText(status: AgentStatus): string {
  switch (status) {
    case 'running': return 'Processing...';
    case 'completed': return 'Task completed';
    case 'failed': return 'Failed';
    case 'paused': return 'Paused';
    default: return 'Ready';
  }
}

export function AgentTabs({
  agents,
  activeAgentId,
  onSelectAgent,
  orphanedAgentIds = [],
}: AgentTabsProps) {
  if (agents.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        No agents configured
      </div>
    );
  }

  // Only show the larger card style if there are multiple agents
  const showCardStyle = agents.length > 1;

  if (!showCardStyle) {
    // Single agent - minimal display
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex justify-center px-4 py-3">
        <ScrollArea className="max-w-3xl">
          <div className="flex gap-2">
            {agents.map((agent) => {
              const isOrphaned = orphanedAgentIds.includes(agent.id);
              const isActive = activeAgentId === agent.id;
              
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className={cn(
                    'group relative flex min-w-[200px] flex-col rounded-lg border px-4 py-3 text-left transition-all',
                    isActive
                      ? 'border-border bg-card shadow-sm'
                      : isOrphaned
                        ? 'border-destructive/50 bg-destructive/5 hover:bg-destructive/10'
                        : 'border-transparent bg-muted/30 hover:bg-muted/50'
                  )}
                >
                  {/* Model name and accept icon */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-sm font-medium',
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {agent.modelId}
                    </span>
                    {agent.accepted ? (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ) : agent.status === 'completed' && !isOrphaned ? (
                      <ThumbsUp className={cn(
                        'h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100',
                        isActive ? 'text-foreground/50' : 'text-muted-foreground'
                      )} />
                    ) : null}
                  </div>
                  
                  {/* Status text */}
                  <span className={cn(
                    'mt-1 text-xs',
                    isOrphaned 
                      ? 'text-destructive' 
                      : 'text-muted-foreground'
                  )}>
                    {isOrphaned ? (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Worktree missing
                      </span>
                    ) : (
                      getStatusText(agent.status)
                    )}
                  </span>
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
