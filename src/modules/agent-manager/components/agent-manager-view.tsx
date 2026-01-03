import { useState, useEffect, useCallback, useRef } from 'react';
import { GitBranch, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@core/ui/button';
import { TaskListSidebar } from './task-list-sidebar';
import { TaskEmptyState } from './task-empty-state';
import { AgentTabs } from './agent-tabs';
import { ChatView } from './chat/chat-view';
import { ChatInput, type ChatInputRef } from './chat/chat-input';
import { CreateTaskDialog } from './create-task-dialog';
import { OptimizationReviewDialog } from './optimization-review-dialog';
import { StatusBadge } from './status-badge';
import { useAgentManagerStore, getAgentKey } from '../store/agent-manager-store';
import { useAppStore } from '@/store/use-app-store';
import { useAgentMessages } from '../hooks/use-agent-messages';
import { usePromptOptimizer } from '../hooks/use-prompt-optimizer';
import type { Task } from '../store/types';
import { logger } from '@core/lib';

export function AgentManagerView() {
  const {
    tasks,
    activeTaskId,
    activeAgentId,
    setActiveTask,
    setActiveAgent,
    loadTasks,
    sendFollowUp,
    acceptAgent,
    removeAgentFromTask,
    stopAgent,
    deleteTask,
    orphanedAgents,
    recreateAgentWorktree,
    isAgentOrphaned,
    isLoading: isLoadingTasks,
  } = useAgentManagerStore();

  const { openInTerminal, openInEditor, revealInFinder, selectedRepositoryId, repositories } = useAppStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [stopAgentConfirm, setStopAgentConfirm] = useState(false);
  const [removeAgentConfirm, setRemoveAgentConfirm] = useState(false);

  // Optimization state
  const [optimizationDialogOpen, setOptimizationDialogOpen] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const chatInputRef = useRef<ChatInputRef>(null);

  // Prompt optimizer hook
  const { optimize, isOptimizing } = usePromptOptimizer();

  // Get the current repository
  const currentRepo = repositories.find((r) => r.id === selectedRepositoryId);

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

  // Get agent key for message lookup
  const agentKey = activeTaskId && activeAgentId ? getAgentKey(activeTaskId, activeAgentId) : null;

  // Get messages from the new message store (no SSE management needed here)
  const { messages, isLoading } = useAgentMessages(agentKey);

  logger.debug('[AgentManagerView]', 'Render', {
    activeTaskId,
    activeAgentId,
    agentKey,
    messagesCount: messages.length,
    isLoading,
  });

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

  // Optimization handlers
  const handleOptimize = useCallback(async (prompt: string) => {
    if (!currentRepo) return;
    
    // Use the optimization model from settings
    const { settings } = useAppStore.getState();
    const optimizationModel = settings.optimizationModel;
    
    if (!optimizationModel) {
      // No optimization model configured - this shouldn't happen since button is disabled
      return;
    }
    
    const model = `${optimizationModel.providerId}/${optimizationModel.modelId}`;
    setOriginalPrompt(prompt);
    
    const result = await optimize(prompt, currentRepo.path, model);
    if (result) {
      setOptimizedPrompt(result);
      setOptimizationDialogOpen(true);
    }
  }, [currentRepo, optimize]);

  const handleAcceptOptimized = useCallback((acceptedPrompt: string) => {
    // Replace the message in the chat input
    chatInputRef.current?.setMessage(acceptedPrompt);
    setOptimizationDialogOpen(false);
    setOriginalPrompt('');
    setOptimizedPrompt('');
  }, []);

  const handleCancelOptimization = useCallback(() => {
    setOptimizationDialogOpen(false);
    setOriginalPrompt('');
    setOptimizedPrompt('');
  }, []);

  // Note: messages and isLoading come from useAgentMessages hook

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
          <div className="flex flex-1 flex-col items-center overflow-hidden">
            <div className="flex w-full max-w-3xl flex-1 flex-col overflow-hidden pt-4">
              {/* Task Header - minimal, centered */}
              <TaskHeader
                task={activeTask}
                onDelete={() => setDeleteConfirmTask(activeTask)}
              />

              {/* Agent Tabs - bigger cards for multi-agent */}
              <AgentTabs
                agents={activeTask.agents}
                activeAgentId={activeAgentId}
                onSelectAgent={handleSelectAgent}
                orphanedAgentIds={orphanedAgents[activeTask.id] || []}
              />

              {/* Orphaned agent warning */}
              {activeAgent && activeAgentId && isAgentOrphaned(activeTask.id, activeAgentId) && (
                <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-4 py-2 mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-medium text-destructive">
                      Worktree Missing
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
                      Recreate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleRemoveAgent}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}

              {/* Chat Area */}
              <div className="flex-1 overflow-hidden">
                <ChatView messages={messages} isLoading={isLoading} />
              </div>

              {/* Chat Input with agent actions */}
              <ChatInput
                ref={chatInputRef}
                onSend={handleSendMessage}
                isLoading={isLoading}
                disabled={!activeAgent}
                agentCount={activeTask.agents.length}
                placeholder={
                  activeAgent
                    ? 'Ask follow-ups in the worktree'
                    : 'Select an agent to send messages'
                }
                agent={activeAgent}
                onAccept={handleAcceptAgent}
                onStop={handleStopAgent}
                onOpenTerminal={handleOpenTerminal}
                onOpenEditor={handleOpenEditor}
                onRevealInFinder={handleRevealInFinder}
                onRemove={handleRemoveAgent}
                onOptimize={activeAgent && currentRepo ? handleOptimize : undefined}
                isOptimizing={isOptimizing}
              />
            </div>
          </div>
        ) : (
          <TaskEmptyState onCreateTask={() => setCreateDialogOpen(true)} />
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Optimization Review Dialog */}
      <OptimizationReviewDialog
        open={optimizationDialogOpen}
        onOpenChange={setOptimizationDialogOpen}
        originalPrompt={originalPrompt}
        optimizedPrompt={optimizedPrompt}
        onAccept={handleAcceptOptimized}
        onCancel={handleCancelOptimization}
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

// Task Header Component - minimal, centered
interface TaskHeaderProps {
  task: Task;
  onDelete: () => void;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function TaskHeader({ task, onDelete }: TaskHeaderProps) {
  return (
    <div className="mb-2">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{task.name}</h2>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{formatTimestamp(task.updatedAt)}</span>
            <span className="opacity-50">|</span>
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {task.sourceType === 'commit'
                ? task.sourceCommit?.slice(0, 7)
                : task.sourceBranch || 'current'}
            </span>
            <span className="opacity-50">|</span>
            <StatusBadge status={task.status} size="sm" />
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onDelete} title="Delete task">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
