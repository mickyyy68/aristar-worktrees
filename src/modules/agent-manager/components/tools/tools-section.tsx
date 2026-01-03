import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { cn } from '@core/lib/utils';
import { useAppStore } from '@/store/use-app-store';
import { ToolCallDisplay } from './tool-call-display';
import type { ToolInvocationPart } from '../../store/types';

interface ToolsSectionProps {
  toolCalls: ToolInvocationPart[];
}

/**
 * Groups tool calls and provides expand/collapse all functionality
 */
export function ToolsSection({ toolCalls }: ToolsSectionProps) {
  const { settings } = useAppStore();
  const { toolDisplay } = settings;

  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const [allToolsExpanded, setAllToolsExpanded] = useState(toolDisplay?.expandToolsByDefault ?? false);

  // Calculate completion status
  const stats = useMemo(() => {
    const completed = toolCalls.filter(
      (t) => t.state === 'completed' || t.state === 'result'
    ).length;
    const errors = toolCalls.filter((t) => t.state === 'error').length;
    const running = toolCalls.filter(
      (t) => t.state === 'running' || t.state === 'pending'
    ).length;
    return { completed, errors, running, total: toolCalls.length };
  }, [toolCalls]);

  if (toolCalls.length === 0) {
    return null;
  }

  const toggleAllTools = () => {
    setAllToolsExpanded(!allToolsExpanded);
  };

  const getStatusText = () => {
    if (stats.running > 0) {
      return `${stats.completed}/${stats.total} complete`;
    }
    if (stats.errors > 0) {
      return `${stats.completed}/${stats.total} complete, ${stats.errors} failed`;
    }
    return `${stats.total} complete`;
  };

  return (
    <div className="my-3 rounded-lg border bg-card/50">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        <button
          onClick={() => setIsSectionExpanded(!isSectionExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80"
        >
          {isSectionExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span>Tools ({stats.total})</span>
          <span className="text-xs font-normal text-muted-foreground">
            {getStatusText()}
          </span>
        </button>

        {isSectionExpanded && (
          <button
            onClick={toggleAllTools}
            className="text-xs text-primary hover:underline"
          >
            {allToolsExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
      </div>

      {/* Tool list */}
      {isSectionExpanded && (
        <div className="p-2 space-y-2">
          {toolCalls.map((toolCall) => (
            <ToolCallDisplay
              key={toolCall.toolInvocationId}
              toolCall={toolCall}
              defaultExpanded={allToolsExpanded}
            />
          ))}
        </div>
      )}

      {/* Collapsed summary */}
      {!isSectionExpanded && (
        <div className="px-3 py-2 flex flex-wrap gap-2">
          {toolCalls.map((toolCall) => (
            <ToolStatusBadge key={toolCall.toolInvocationId} toolCall={toolCall} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact badge showing tool name and status
 */
function ToolStatusBadge({ toolCall }: { toolCall: ToolInvocationPart }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    running: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    result: 'bg-green-500/10 text-green-500 border-green-500/20',
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const statusIcons: Record<string, string> = {
    pending: '',
    running: '',
    completed: '',
    result: '',
    error: '',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        statusColors[toolCall.state] || statusColors.pending
      )}
    >
      {statusIcons[toolCall.state]}
      {toolCall.toolName}
    </span>
  );
}
