import {
  MoreVertical,
  Play,
  Pause,
  Square,
  Star,
  Terminal,
  Code,
  Folder,
  Trash2,
} from 'lucide-react';
import { Button } from '@core/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@core/ui/dropdown-menu';
import type { TaskAgent } from '../store/types';

interface AgentActionsProps {
  agent: TaskAgent;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onAccept?: () => void;
  onOpenTerminal?: () => void;
  onOpenEditor?: () => void;
  onRevealInFinder?: () => void;
  onRemove?: () => void;
}

export function AgentActions({
  agent,
  onPause,
  onResume,
  onStop,
  onAccept,
  onOpenTerminal,
  onOpenEditor,
  onRevealInFinder,
  onRemove,
}: AgentActionsProps) {
  const isRunning = agent.status === 'running';
  const isPaused = agent.status === 'paused';
  const canPause = isRunning && onPause;
  const canResume = isPaused && onResume;
  const canStop = (isRunning || isPaused) && onStop;
  const canAccept = !agent.accepted && onAccept;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Execution controls */}
        {canPause && (
          <DropdownMenuItem onClick={onPause}>
            <Pause className="mr-2 h-4 w-4" />
            Pause
          </DropdownMenuItem>
        )}
        {canResume && (
          <DropdownMenuItem onClick={onResume}>
            <Play className="mr-2 h-4 w-4" />
            Resume
          </DropdownMenuItem>
        )}
        {canStop && (
          <DropdownMenuItem onClick={onStop}>
            <Square className="mr-2 h-4 w-4" />
            Stop
          </DropdownMenuItem>
        )}
        
        {/* Accept as winner */}
        {canAccept && (
          <>
            {(canPause || canResume || canStop) && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={onAccept}>
              <Star className="mr-2 h-4 w-4" />
              Accept as winner
            </DropdownMenuItem>
          </>
        )}
        
        {/* File/folder actions */}
        <DropdownMenuSeparator />
        {onOpenTerminal && (
          <DropdownMenuItem onClick={onOpenTerminal}>
            <Terminal className="mr-2 h-4 w-4" />
            Open in Terminal
          </DropdownMenuItem>
        )}
        {onOpenEditor && (
          <DropdownMenuItem onClick={onOpenEditor}>
            <Code className="mr-2 h-4 w-4" />
            Open in Editor
          </DropdownMenuItem>
        )}
        {onRevealInFinder && (
          <DropdownMenuItem onClick={onRevealInFinder}>
            <Folder className="mr-2 h-4 w-4" />
            Reveal in Finder
          </DropdownMenuItem>
        )}
        
        {/* Destructive action */}
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Agent
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Inline action buttons for toolbar
interface AgentToolbarActionsProps {
  agent: TaskAgent;
  onAccept?: () => void;
  onOpenTerminal?: () => void;
  onOpenEditor?: () => void;
}

export function AgentToolbarActions({
  agent,
  onAccept,
  onOpenTerminal,
  onOpenEditor,
}: AgentToolbarActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {!agent.accepted && onAccept && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAccept}
          className="h-8 gap-1.5"
        >
          <Star className="h-4 w-4" />
          Accept
        </Button>
      )}
      {onOpenTerminal && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenTerminal}
          className="h-8 w-8"
          title="Open in Terminal"
        >
          <Terminal className="h-4 w-4" />
        </Button>
      )}
      {onOpenEditor && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenEditor}
          className="h-8 w-8"
          title="Open in Editor"
        >
          <Code className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
