import { Bot, Plus } from 'lucide-react';
import { Button } from '@core/ui/button';

interface TaskEmptyStateProps {
  onCreateTask: () => void;
}

export function TaskEmptyState({ onCreateTask }: TaskEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-6 rounded-full bg-primary/10 p-6">
        <Bot className="h-12 w-12 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">No Task Selected</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        Select a task from the sidebar to view its agents and conversation,
        or create a new task to start working with multiple AI models in parallel.
      </p>
      <Button onClick={onCreateTask} size="lg">
        <Plus className="mr-2 h-5 w-5" />
        Create New Task
      </Button>
    </div>
  );
}
