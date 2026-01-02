import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolInvocationPart } from '@/store/types';

interface ToolCallDisplayProps {
  toolCall: ToolInvocationPart;
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (toolCall.state) {
      case 'pending':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
      case 'result':
        return <Check className="h-3.5 w-3.5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Wrench className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const hasArgs = toolCall.args !== undefined && toolCall.args !== null;
  const hasResult = toolCall.result !== undefined && toolCall.result !== null;
  const hasDetails = hasArgs || hasResult;

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  return (
    <div className="my-2 rounded-lg border bg-muted/30">
      <button
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
          hasDetails ? 'cursor-pointer hover:bg-muted/50' : ''
        )}
        disabled={!hasDetails}
      >
        {hasDetails ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <div className="w-4" />
        )}
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 font-medium">{toolCall.toolName}</span>
        {getStatusIcon()}
      </button>

      {isExpanded && hasDetails && (
        <div className="border-t px-3 py-2">
          {hasArgs && (
            <div className="mb-2">
              <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                Arguments
              </div>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {formatValue(toolCall.args)}
              </pre>
            </div>
          )}
          {hasResult && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                Result
              </div>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {formatValue(toolCall.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
