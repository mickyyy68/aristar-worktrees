import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Star, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@core/ui/button';
import { TaskListSidebar } from './task-list-sidebar';
import { TaskEmptyState } from './task-empty-state';
import { AgentTabs } from './agent-tabs';
import { ChatView } from './chat/chat-view';
import { ChatInput } from './chat/chat-input';
import { AgentActions, AgentToolbarActions } from './agent-actions';
import { CreateTaskDialog } from './create-task-dialog';
import { StatusBadge } from './status-badge';
import { useAgentManagerStore } from '../store/agent-manager-store';
import { useAppStore } from '@/store/use-app-store';
import { useAgentSSE } from '../api/use-agent-sse';
import type { Task } from '../store/types';

export function AgentManagerView() {
  const {
    tasks,
    activeTaskId,
    activeAgentId,
    setActiveTask,
    setActiveAgent,
    loadTasks,
    sendFollowUp,
    agentOpencodePorts,
    acceptAgent,
    removeAgentFromTask,
    stopAgent,
    deleteTask,
    orphanedAgents,
    recreateAgentWorktree,
    isAgentOrphaned,
    isLoading: isLoadingTasks,
  } = useAgentManagerStore();

  const { openInTerminal, openInEditor, revealInFinder } = useAppStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [stopAgentConfirm, setStopAgentConfirm] = useState(false);
  const [removeAgentConfirm, setRemoveAgentConfirm] = useState(false);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const activeAgent = activeTask?.agents.find((a) => a.id === activeAgentId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+N or Ctrl+N: Open new task dialog
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setCreateDialogOpen(true);
        return;
      }

      // Tab switching between agents (only when not in an input)
      const isInInput = ['INPUT', 'TEXTAREA'].includes(
        (e.target as HTMLElement)?.tagName
      );

      if (!isInInput && activeTask && activeTask.agents.length > 1) {
        const currentIndex = activeTask.agents.findIndex(
          (a) => a.id === activeAgentId
        );

        if (e.key === 'Tab' && !e.shiftKey) {
          // Tab: Next agent
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % activeTask.agents.length;
          setActiveAgent(activeTask.agents[nextIndex].id);
        } else if (e.key === 'Tab' && e.shiftKey) {
          // Shift+Tab: Previous agent
          e.preventDefault();
          const prevIndex =
            currentIndex <= 0
              ? activeTask.agents.length - 1
              : currentIndex - 1;
          setActiveAgent(activeTask.agents[prevIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTask, activeAgentId, setActiveAgent]);

  // Get port and session for SSE subscription
  const agentPort = activeAgentId ? agentOpencodePorts[activeAgentId] : null;
  const agentSessionId = activeAgent?.sessionId || null;

  // Subscribe to SSE events for the active agent
  const { messages, isLoading } = useAgentSSE(
    activeAgentId,
    agentPort || null,
    agentSessionId
  );

  const handleSelectTask = useCallback((taskId: string) => {
    setActiveTask(taskId);
  }, [setActiveTask]);

  const handleSelectAgent = useCallback((agentId: string) => {
    setActiveAgent(agentId);
  }, [setActiveAgent]);

  const handleSendMessage = useCallback(async (message: string, sendToAll: boolean) => {
    if (!activeTask) return;
    
    if (sendToAll) {
      await sendFollowUp(activeTask.id, message);
    } else if (activeAgentId) {
      await sendFollowUp(activeTask.id, message, [activeAgentId]);
    }
  }, [activeTask, activeAgentId, sendFollowUp]);

  const handleAcceptAgent = useCallback(async () => {
    if (!activeTask || !activeAgentId) return;
    await acceptAgent(activeTask.id, activeAgentId);
  }, [activeTask, activeAgentId, acceptAgent]);

  const handleStopAgent = useCallback(async () => {
    if (!activeTask || !activeAgentId) return;
    // Show confirmation for running agents
    if (activeAgent?.status === 'running') {
      setStopAgentConfirm(true);
      return;
    }
    await stopAgent(activeTask.id, activeAgentId);
  }, [activeTask, activeAgentId, activeAgent?.status, stopAgent]);

  const confirmStopAgent = useCallback(async () => {
    if (!activeTask || !activeAgentId) return;
    await stopAgent(activeTask.id, activeAgentId);
    setStopAgentConfirm(false);
  }, [activeTask, activeAgentId, stopAgent]);

  const handleRemoveAgent = useCallback(async () => {
    if (!activeTask || !activeAgentId) return;
    setRemoveAgentConfirm(true);
  }, [activeTask, activeAgentId]);

  const confirmRemoveAgent = useCallback(async () => {
    if (!activeTask || !activeAgentId) return;
    await removeAgentFromTask(activeTask.id, activeAgentId, true);
    setRemoveAgentConfirm(false);
  }, [activeTask, activeAgentId, removeAgentFromTask]);

  const handleOpenTerminal = useCallback(async () => {
    if (!activeAgent) return;
    await openInTerminal(activeAgent.worktreePath);
  }, [activeAgent, openInTerminal]);

  const handleOpenEditor = useCallback(async () => {
    if (!activeAgent) return;
    await openInEditor(activeAgent.worktreePath);
  }, [activeAgent, openInEditor]);

  const handleRevealInFinder = useCallback(async () => {
    if (!activeAgent) return;
    await revealInFinder(activeAgent.worktreePath);
  }, [activeAgent, revealInFinder]);

  const handleDeleteTask = useCallback(async () => {
    if (!deleteConfirmTask) return;
    await deleteTask(deleteConfirmTask.id, true);
    setDeleteConfirmTask(null);
  }, [deleteConfirmTask, deleteTask]);

  // Note: messages and isLoading now come from useAgentSSE hook above

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Task List Sidebar */}
      <TaskListSidebar
        tasks={tasks}
        activeTaskId={activeTaskId}
        onSelectTask={handleSelectTask}
        onCreateTask={() => setCreateDialogOpen(true)}
        isLoading={isLoadingTasks}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTask ? (
          <>
            {/* Task Header */}
            <TaskHeader
              task={activeTask}
              onDelete={() => setDeleteConfirmTask(activeTask)}
            />

            {/* Agent Tabs */}
            <AgentTabs
              agents={activeTask.agents}
              activeAgentId={activeAgentId}
              onSelectAgent={handleSelectAgent}
              orphanedAgentIds={orphanedAgents[activeTask.id] || []}
            />

            {/* Agent Toolbar */}
            {activeAgent && activeAgentId && isAgentOrphaned(activeTask.id, activeAgentId) ? (
              // Orphaned agent toolbar
              <div className="flex items-center justify-between border-b bg-destructive/10 px-4 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">
                    Worktree Missing
                  </span>
                  <span className="text-muted-foreground">
                    - {activeAgent.providerId}/{activeAgent.modelId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await recreateAgentWorktree(activeTask.id, activeAgentId);
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recreate Worktree
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRemoveAgent}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Agent
                  </Button>
                </div>
              </div>
            ) : activeAgent && (
              // Normal agent toolbar
              <div className="flex items-center justify-between border-b bg-card px-4 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {activeAgent.providerId}/{activeAgent.modelId}
                  </span>
                  <StatusBadge status={activeAgent.status} size="sm" />
                  {activeAgent.accepted && (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      Accepted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <AgentToolbarActions
                    agent={activeAgent}
                    onAccept={handleAcceptAgent}
                    onOpenTerminal={handleOpenTerminal}
                    onOpenEditor={handleOpenEditor}
                  />
                  <AgentActions
                    agent={activeAgent}
                    onStop={handleStopAgent}
                    onAccept={handleAcceptAgent}
                    onOpenTerminal={handleOpenTerminal}
                    onOpenEditor={handleOpenEditor}
                    onRevealInFinder={handleRevealInFinder}
                    onRemove={handleRemoveAgent}
                  />
                </div>
              </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden">
              <ChatView messages={messages} isLoading={isLoading} />
            </div>

            {/* Chat Input */}
            <ChatInput
              onSend={handleSendMessage}
              isLoading={isLoading}
              disabled={!activeAgent}
              agentCount={activeTask.agents.length}
              placeholder={
                activeAgent
                  ? 'Send a follow-up message...'
                  : 'Select an agent to send messages'
              }
            />
          </>
        ) : (
          <TaskEmptyState onCreateTask={() => setCreateDialogOpen(true)} />
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Delete Task Confirmation */}
      {deleteConfirmTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Delete Task</h3>
            <p className="mb-4 text-muted-foreground">
              Are you sure you want to delete "{deleteConfirmTask.name}"?
              This will also delete all agent worktrees and cannot be undone.
            </p>
            {deleteConfirmTask.status === 'running' && (
              <p className="mb-4 text-sm text-destructive">
                Warning: This task has running agents that will be stopped.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmTask(null)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteTask}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Task
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Agent Confirmation */}
      {stopAgentConfirm && activeAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Stop Agent</h3>
            <p className="mb-4 text-muted-foreground">
              Are you sure you want to stop the running agent "{activeAgent.modelId}"?
              The agent will be interrupted and any ongoing work may be lost.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStopAgentConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmStopAgent}>
                Stop Agent
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Agent Confirmation */}
      {removeAgentConfirm && activeAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Remove Agent</h3>
            <p className="mb-4 text-muted-foreground">
              Are you sure you want to remove the agent "{activeAgent.modelId}"?
              This will delete its worktree and cannot be undone.
            </p>
            {activeAgent.status === 'running' && (
              <p className="mb-4 text-sm text-destructive">
                Warning: This agent is currently running and will be stopped.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoveAgentConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRemoveAgent}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Agent
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Header Component
interface TaskHeaderProps {
  task: Task;
  onDelete: () => void;
}

function TaskHeader({ task, onDelete }: TaskHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b bg-card px-6 py-4">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">{task.name}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              {task.sourceType === 'commit'
                ? `Commit: ${task.sourceCommit?.slice(0, 7)}`
                : task.sourceBranch || 'current branch'}
            </span>
            <span>|</span>
            <span>
              {task.agents.length} agent{task.agents.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>
      <Button variant="ghost" size="icon" onClick={onDelete} title="Delete task">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
