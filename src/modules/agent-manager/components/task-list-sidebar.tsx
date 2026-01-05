import { Plus, Clock, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@core/ui/button';
import { ScrollArea } from '@core/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@core/ui/tooltip';
import { StatusDot } from './status-badge';
import { cn } from '@core/lib/utils';
import { useAppStore } from '@/store/use-app-store';
import type { Task } from '../store/types';

interface TaskListSidebarProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onCreateTask: () => void;
  isLoading?: boolean;
}

// Skeleton loader for task items
function TaskSkeleton() {
  return (
    <div className="mb-1 w-full rounded-lg p-3">
      <div className="flex items-start gap-2">
        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function TaskListSidebar({
  tasks,
  activeTaskId,
  onSelectTask,
  onCreateTask,
  isLoading = false,
}: TaskListSidebarProps) {
  const { settings, setSettings } = useAppStore();
  const isCollapsed = settings.sidebarCollapsed;
  const toggleSidebar = () => setSettings({ sidebarCollapsed: !isCollapsed });

  // Sort tasks by updatedAt descending (most recent first)
  const sortedTasks = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt);

  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col border-r bg-card">
        <div className="flex flex-col items-center gap-2 border-b p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onCreateTask}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Task</TooltipContent>
          </Tooltip>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col items-center gap-1 p-2">
            {sortedTasks.map((task) => (
              <Tooltip key={task.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectTask(task.id)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      activeTaskId === task.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    <StatusDot status={task.status} size="sm" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{task.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <Button onClick={onCreateTask} className="flex-1" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={toggleSidebar}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Collapse sidebar</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          // Skeleton loading state
          <div className="p-2">
            <TaskSkeleton />
            <TaskSkeleton />
            <TaskSkeleton />
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No tasks yet. Create your first task to get started.
          </div>
        ) : (
          <div className="p-2">
            {sortedTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={cn(
                  'mb-1 w-full rounded-lg p-3 text-left transition-colors',
                  activeTaskId === task.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-start gap-2">
                  <StatusDot status={task.status} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">
                      {task.name}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{task.agents.length} agent{task.agents.length !== 1 ? 's' : ''}</span>
                      <span className="opacity-50">|</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(task.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
