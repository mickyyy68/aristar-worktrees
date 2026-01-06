import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@core/lib/utils';
import { useAppStore } from '@/store/use-app-store';
import { getToolConfig, getToolLabel } from './tool-config';
import type { ToolInvocationPart } from '../../api/opencode-types';
import { useDiffStore } from '../../store/diff-store';
import { useAgentManagerStore } from '../../store/agent-manager-store';
import { DiffViewer } from './diff-viewer';

interface ToolCallDisplayProps {
  toolCall: ToolInvocationPart;
  defaultExpanded?: boolean;
}

interface ToolArgs {
  command?: string;
  description?: string;
  filePath?: string;
  pattern?: string;
  path?: string;
  content?: string;
  oldString?: string;
  newString?: string;
  query?: string;
  url?: string;
  prompt?: string;
  [key: string]: unknown;
}

/**
 * Extract a human-readable description from tool args
 */
function getToolDescription(toolName: string, args: ToolArgs | undefined): string | null {
  if (!args) return null;

  // First, check for explicit description field
  if (args.description && typeof args.description === 'string') {
    return args.description;
  }

  // Tool-specific fallbacks
  switch (toolName.toLowerCase()) {
    case 'bash':
      return args.command ? `Run: ${truncateString(args.command, 60)}` : null;
    case 'read':
      return args.filePath ? `Read ${getFileName(args.filePath)}` : null;
    case 'write':
      return args.filePath ? `Write ${getFileName(args.filePath)}` : null;
    case 'edit':
      return args.filePath ? `Edit ${getFileName(args.filePath)}` : null;
    case 'glob':
      return args.pattern ? `Find files: ${args.pattern}` : null;
    case 'grep':
      return args.pattern ? `Search: ${args.pattern}` : null;
    case 'list':
      return args.path ? `List ${args.path}` : null;
    case 'webfetch':
      return args.url ? `Fetch ${truncateString(args.url, 50)}` : null;
    case 'task':
      return args.prompt ? truncateString(args.prompt, 60) : null;
    default:
      return null;
  }
}

/**
 * Get the primary command/input to display
 */
function getToolCommand(toolName: string, args: ToolArgs | undefined): string | null {
  if (!args) return null;

  switch (toolName.toLowerCase()) {
    case 'bash':
      return args.command || null;
    case 'read':
    case 'write':
    case 'edit':
      return args.filePath || null;
    case 'glob':
      return args.pattern || null;
    case 'grep':
      return args.pattern ? `/${args.pattern}/` : null;
    case 'list':
      return args.path || null;
    case 'webfetch':
      return args.url || null;
    case 'task':
      return args.prompt || null;
    default:
      // For unknown tools, try to find something meaningful
      if (args.command) return args.command;
      if (args.filePath) return args.filePath;
      if (args.path) return args.path;
      if (args.query) return args.query;
      return null;
  }
}

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

export function ToolCallDisplay({ toolCall, defaultExpanded }: ToolCallDisplayProps) {
  const { settings } = useAppStore();
  const { toolDisplay } = settings;

  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded ?? toolDisplay?.expandToolsByDefault ?? false
  );
  const [isOutputExpanded, setIsOutputExpanded] = useState(
    toolDisplay?.outputVisibility === 'always'
  );

  const toolConfig = useMemo(() => getToolConfig(toolCall.toolName), [toolCall.toolName]);
  const toolLabel = useMemo(() => getToolLabel(toolCall.toolName), [toolCall.toolName]);

  // Get session ID for diff lookup
  const { activeTaskId, tasks, activeAgentId } = useAgentManagerStore();
  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const activeAgent = activeTask?.agents.find((a) => a.id === activeAgentId);
  const sessionId = activeAgent?.sessionId;

  // Check if this is an Edit/Write tool and get diff if available
  const isFileEditTool = ['edit', 'write'].includes(toolCall.toolName.toLowerCase());
  const filePath = (toolCall.args as ToolArgs)?.filePath;

  const diff = useDiffStore((state) => {
    if (!isFileEditTool || !sessionId || !filePath) return null;
    return state.getDiffForFile(sessionId, filePath);
  });

  const args = toolCall.args as ToolArgs | undefined;
  const description = getToolDescription(toolCall.toolName, args);
  const command = getToolCommand(toolCall.toolName, args);

  const hasResult = toolCall.result !== undefined && toolCall.result !== null;
  const resultString = hasResult ? formatResult(toolCall.result) : null;
  const truncatedResult = resultString ? truncateOutput(resultString, toolDisplay?.truncatedOutputLines ?? 10) : null;
  const isResultTruncated = resultString && truncatedResult && resultString !== truncatedResult;

  const Icon = toolConfig.icon;

  const getStatusIcon = () => {
    switch (toolCall.state) {
      case 'pending':
      case 'running':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
      case 'result':
      case 'completed':
        return <Check className="h-3.5 w-3.5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  const displayText = description || toolLabel;
  const showCommand = toolDisplay?.showToolCommands && command;
  const canExpand = hasResult || (command && !toolDisplay?.showToolCommands);

  return (
    <div className="group rounded-md border bg-muted/20 transition-colors hover:bg-muted/30">
      {/* Header row */}
      <button
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
          canExpand && 'cursor-pointer'
        )}
        disabled={!canExpand}
      >
        {/* Expand/collapse chevron */}
        {canExpand ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <div className="w-3.5 shrink-0" />
        )}

        {/* Tool icon */}
        <Icon className={cn('h-4 w-4 shrink-0', toolConfig.colorClass)} />

        {/* Description / label */}
        <span className="flex-1 truncate font-medium">{displayText}</span>

        {/* Status icon */}
        {getStatusIcon()}
      </button>

      {/* Command preview (when showToolCommands is enabled) */}
      {showCommand && (
        <div className="border-t border-border/50 px-3 py-1.5">
          <code className="block truncate text-xs text-muted-foreground font-mono">
            {toolCall.toolName === 'bash' ? '$ ' : ''}{command}
          </code>
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {/* Show command if not already shown above */}
          {command && !toolDisplay?.showToolCommands && (
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {toolCall.toolName === 'bash' ? 'Command' : 'Input'}
              </div>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs font-mono">
                {toolCall.toolName === 'bash' ? '$ ' : ''}{command}
              </pre>
            </div>
          )}

          {/* Output/Result */}
          {hasResult && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Output</span>
                {toolDisplay?.outputVisibility === 'hidden' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOutputExpanded(!isOutputExpanded);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {isOutputExpanded ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>

              {(toolDisplay?.outputVisibility !== 'hidden' || isOutputExpanded) && (
                <div className="relative">
                  <pre className="overflow-x-auto rounded bg-muted p-2 text-xs font-mono max-h-80 overflow-y-auto">
                    {toolDisplay?.outputVisibility === 'truncated' && !isOutputExpanded
                      ? truncatedResult
                      : resultString}
                  </pre>
                  {toolDisplay?.outputVisibility === 'truncated' && isResultTruncated && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOutputExpanded(!isOutputExpanded);
                      }}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      {isOutputExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Diff viewer for file edit tools */}
          {diff && (
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Changes</div>
              <DiffViewer diff={diff} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatResult(result: unknown): string {
  if (typeof result === 'string') return result;
  return JSON.stringify(result, null, 2);
}

function truncateOutput(output: string, maxLines: number): string {
  const lines = output.split('\n');
  if (lines.length <= maxLines) return output;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
}
