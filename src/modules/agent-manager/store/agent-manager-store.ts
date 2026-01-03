import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type {
  Task,
  OpenCodeProvider,
  OpenCodeAgentConfig,
  CreateTaskParams,
  ModelSelection,
  AgentStatus,
  MessagePart,
} from './types';
import type { OpenCodeMessage, OpenCodeMessageExtended } from '../api/opencode';
import { opencodeClient, opencodeClientManager } from '../api/opencode';
import { commands } from '@core/lib';
import { sendMessageAsync } from '../api/use-agent-sse';

// ============ Helper Functions ============

/**
 * Generate a composite key for agent-specific state (messages, loading, etc.)
 * Agent IDs are only unique within a task (e.g., "agent-1"), so we need to
 * combine taskId and agentId to create a globally unique key.
 */
export function getAgentKey(taskId: string, agentId: string): string {
  return `${taskId}:${agentId}`;
}

/**
 * Track agents that are currently being recovered to prevent race conditions.
 * This prevents duplicate recovery attempts when setActiveAgent and useAgentSSE
 * both trigger recovery simultaneously.
 */
const agentsBeingRecovered = new Set<string>();

/**
 * Extract content from extended message parts.
 * Only extracts text parts - reasoning is stored separately and not shown as main content.
 */
function extractContentFromParts(parts: MessagePart[]): string {
  if (!parts || parts.length === 0) {
    console.log('[extractContentFromParts] No parts provided');
    return '';
  }

  console.log('[extractContentFromParts] Input parts:', JSON.stringify(parts, null, 2));

  const textParts: string[] = [];

  for (const part of parts) {
    console.log('[extractContentFromParts] Processing part:', {
      type: part.type,
      hasText: 'text' in part,
      textValue: part.type === 'text' ? (part as any).text : undefined
    });
    
    // Only extract text parts - reasoning is internal thinking and should not be shown
    if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
      textParts.push(part.text);
    }
    // Skip reasoning, tool, step-start, step-finish parts - they don't contribute to main content
  }

  const allText = textParts.join('\n');
  console.log('[extractContentFromParts] Result:', {
    textPartsCount: textParts.length,
    extractedContent: allText.substring(0, 200) + '...'
  });
  
  return allText;
}

/**
 * Convert extended messages (with parts) to standard OpenCodeMessage format.
 * Properly extracts content from text and reasoning parts.
 */
function extendedToStandardMessages(messages: OpenCodeMessageExtended[]): OpenCodeMessage[] {
  console.log('[extendedToStandardMessages] Input messages:', messages.length);
  
  const result = messages.map((msg, index) => {
    const extractedContent = extractContentFromParts(msg.parts || []);
    console.log(`[extendedToStandardMessages] Message ${index}:`, {
      id: msg.id,
      role: msg.role,
      partsCount: msg.parts?.length,
      extractedContent: extractedContent.substring(0, 100) + '...'
    });
    
    return {
      id: msg.id,
      role: msg.role,
      content: extractedContent,
      timestamp: msg.timestamp,
    };
  });
  
  console.log('[extendedToStandardMessages] Output messages:', result.length);
  return result;
}

// ============ State Interface ============

interface AgentManagerState {
  // Data
  tasks: Task[];
  activeTaskId: string | null;
  activeAgentId: string | null;

  // OpenCode data
  providers: OpenCodeProvider[];
  availableAgents: OpenCodeAgentConfig[];

  // UI State
  isLoading: boolean;
  isLoadingOpenCodeData: boolean;
  error: string | null;

  // Per-agent chat state (keyed by taskId:agentId composite key)
  agentMessages: Record<string, OpenCodeMessage[]>; // "taskId:agentId" -> messages
  agentLoading: Record<string, boolean>; // "taskId:agentId" -> loading state

  // OpenCode connection state per agent (keyed by taskId:agentId composite key)
  agentOpencodePorts: Record<string, number>; // "taskId:agentId" -> port

  // Orphaned agents (worktree missing)
  orphanedAgents: Record<string, string[]>; // taskId -> agentIds with missing worktrees
}

// ============ Actions Interface ============

interface AgentManagerActions {
  // Task CRUD
  loadTasks: () => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<Task>;
  deleteTask: (taskId: string, deleteWorktrees: boolean) => Promise<void>;

  // Agent management
  addAgentToTask: (taskId: string, model: ModelSelection) => Promise<void>;
  removeAgentFromTask: (taskId: string, agentId: string, deleteWorktree: boolean) => Promise<void>;
  acceptAgent: (taskId: string, agentId: string) => Promise<void>;
  cleanupUnacceptedAgents: (taskId: string) => Promise<void>;

  // Agent execution
  startAgent: (taskId: string, agentId: string, initialPrompt: string) => Promise<void>;
  stopAgent: (taskId: string, agentId: string) => Promise<void>;

  // Task execution (all agents)
  startTask: (taskId: string, initialPrompt: string) => Promise<void>;
  stopTask: (taskId: string) => Promise<void>;

  // Follow-ups
  sendFollowUp: (taskId: string, prompt: string, targetAgentIds?: string[]) => Promise<void>;

  // OpenCode data
  loadProviders: (port: number) => Promise<OpenCodeProvider[]>;
  loadAvailableAgents: (port: number) => Promise<OpenCodeAgentConfig[]>;
  refreshOpenCodeData: (repoPath: string) => Promise<void>;
  isLoadingOpenCodeData: boolean;

  // Navigation
  setActiveTask: (taskId: string | null) => void;
  setActiveAgent: (agentId: string | null) => void;

  // Messages
  loadAgentMessages: (taskId: string, agentId: string) => Promise<void>;
  clearAgentMessages: (taskId: string, agentId: string) => void;
  addAgentMessage: (taskId: string, agentId: string, message: OpenCodeMessage) => void;

  // Error handling
  clearError: () => void;
  setError: (error: string) => void;

  // Orphaned agent handling
  validateTaskWorktrees: (taskId: string) => Promise<string[]>;
  recreateAgentWorktree: (taskId: string, agentId: string) => Promise<void>;
  isAgentOrphaned: (taskId: string, agentId: string) => boolean;

  // OpenCode server recovery
  recoverTaskAgents: (taskId: string) => Promise<void>;

  // Agent/Task status updates
  markAgentIdle: (taskId: string, agentId: string) => Promise<void>;
  updateTaskStatusFromAgents: (taskId: string) => Promise<void>;
}

type AgentManagerStore = AgentManagerState & AgentManagerActions;

// ============ Store Implementation ============

export const useAgentManagerStore = create<AgentManagerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      tasks: [],
      activeTaskId: null,
      activeAgentId: null,
      providers: [],
      availableAgents: [],
      isLoading: false,
      isLoadingOpenCodeData: false,
      error: null,
      agentMessages: {},
      agentLoading: {},
      agentOpencodePorts: {},
      orphanedAgents: {},

      // ============ Task CRUD ============

      loadTasks: async () => {
        set({ isLoading: true, error: null });
        try {
          const tasks = await commands.getTasks();
          
          // Build set of valid agent keys from loaded tasks
          const validAgentKeys = new Set<string>();
          for (const task of tasks) {
            for (const agent of task.agents) {
              validAgentKeys.add(getAgentKey(task.id, agent.id));
            }
          }
          
          // Clean up stale agent data (messages, loading, ports) for non-existent tasks/agents
          // This handles orphaned data from deleted tasks or old key format (pre-composite keys)
          const { agentMessages, agentLoading, agentOpencodePorts } = get();
          
          const cleanedMessages: Record<string, OpenCodeMessage[]> = {};
          const cleanedLoading: Record<string, boolean> = {};
          const cleanedPorts: Record<string, number> = {};
          
          for (const key of Object.keys(agentMessages)) {
            if (validAgentKeys.has(key)) {
              cleanedMessages[key] = agentMessages[key];
            }
          }
          for (const key of Object.keys(agentLoading)) {
            if (validAgentKeys.has(key)) {
              cleanedLoading[key] = agentLoading[key];
            }
          }
          for (const key of Object.keys(agentOpencodePorts)) {
            if (validAgentKeys.has(key)) {
              cleanedPorts[key] = agentOpencodePorts[key];
            }
          }
          
          set({
            agentMessages: cleanedMessages,
            agentLoading: cleanedLoading,
            agentOpencodePorts: cleanedPorts,
          });
          
          // Reset stale running agents on app startup
          // When app restarts, OpenCode servers are not running, so "running" status is stale
          let needsRefetch = false;
          for (const task of tasks) {
            for (const agent of task.agents) {
              if (agent.status === 'running') {
                // Reset to idle since server isn't running on fresh app start
                await commands.updateAgentStatus(task.id, agent.id, 'idle' as AgentStatus);
                needsRefetch = true;
              }
            }
            // Also reset task status if it was running
            if (task.status === 'running') {
              await commands.updateTask(task.id, undefined, 'idle' as any);
              needsRefetch = true;
            }
          }
          
          // Re-fetch tasks with corrected statuses if any were updated
          const correctedTasks = needsRefetch ? await commands.getTasks() : tasks;
          set({ tasks: correctedTasks, isLoading: false });
          
          // Validate worktrees for all tasks
          const orphanedAgents: Record<string, string[]> = {};
          for (const task of correctedTasks) {
            const orphanedIds = await commands.validateTaskWorktrees(task.id);
            if (orphanedIds.length > 0) {
              orphanedAgents[task.id] = orphanedIds;
            }
          }
          
          set({ orphanedAgents });
          
          // Show warning if there are orphaned agents
          const totalOrphaned = Object.values(orphanedAgents).flat().length;
          if (totalOrphaned > 0) {
            toast.warning('Orphaned agents detected', {
              description: `${totalOrphaned} agent(s) have missing worktrees`,
            });
          }
          
          // Recover agents for the active task (restored from localStorage)
          // This restarts OpenCode servers and loads chat messages
          const { activeTaskId, activeAgentId: _activeAgentId } = get();
          if (activeTaskId) {
            // Verify the active task still exists
            if (correctedTasks.some(t => t.id === activeTaskId)) {
              get().recoverTaskAgents(activeTaskId);
            } else {
              // Active task was deleted, clear selection
              set({ activeTaskId: null, activeAgentId: null });
            }
          }
        } catch (err) {
          console.error('[loadTasks] Error:', err);
          const errorMsg = String(err);
          set({ error: errorMsg, isLoading: false });
          toast.error('Failed to load tasks', { description: errorMsg });
        }
      },

      createTask: async (params) => {
        set({ isLoading: true, error: null });
        try {
          const task = await commands.createTask(
            params.name,
            params.sourceType,
            params.sourceBranch,
            params.sourceCommit,
            params.sourceRepoPath,
            params.agentType,
            params.models
          );
          set((state) => ({
            tasks: [...state.tasks, task],
            activeTaskId: task.id,
            activeAgentId: task.agents[0]?.id || null,
            isLoading: false,
          }));
          toast.success('Task created', { description: task.name });
          return task;
        } catch (err) {
          const errorMsg = String(err);
          set({ error: errorMsg, isLoading: false });
          toast.error('Failed to create task', { description: errorMsg });
          throw err;
        }
      },

      deleteTask: async (taskId, deleteWorktrees) => {
        set({ isLoading: true, error: null });
        try {
          // Get the task to clean up agent-specific resources
          const { tasks } = get();
          const task = tasks.find((t) => t.id === taskId);
          
          // Stop all OpenCode servers for this task first
          await commands.stopTaskAllOpencode(taskId);
          
          // Clean up SSE and client resources for all agents in this task
          if (task) {
            for (const agent of task.agents) {
              const agentKey = getAgentKey(taskId, agent.id);
              opencodeClientManager.cleanupSSE(agentKey);
              opencodeClientManager.removeClient(agentKey);
            }
          }

          await commands.deleteTask(taskId, deleteWorktrees);
          set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== taskId),
            activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
            activeAgentId: state.activeTaskId === taskId ? null : state.activeAgentId,
            isLoading: false,
          }));
          toast.success('Task deleted');
        } catch (err) {
          const errorMsg = String(err);
          set({ error: errorMsg, isLoading: false });
          toast.error('Failed to delete task', { description: errorMsg });
        }
      },

      // ============ Agent Management ============

      addAgentToTask: async (taskId, model) => {
        set({ isLoading: true, error: null });
        try {
          const updatedTask = await commands.addAgentToTask(
            taskId,
            model.modelId,
            model.providerId,
            undefined
          );
          set((state) => ({
            tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      removeAgentFromTask: async (taskId, agentId, deleteWorktree) => {
        set({ isLoading: true, error: null });
        try {
          // Stop OpenCode for this agent first
          try {
            await commands.stopAgentOpencode(taskId, agentId);
          } catch {
            // Ignore errors if server wasn't running
          }

          await commands.removeAgentFromTask(taskId, agentId, deleteWorktree);
          
          // Clean up agent-specific state (ports, messages, loading, client, SSE)
          const agentKey = getAgentKey(taskId, agentId);
          
          // Clean up the per-agent OpenCode client and SSE subscription
          opencodeClientManager.cleanupSSE(agentKey);
          opencodeClientManager.removeClient(agentKey);
          
          set((state) => {
            // Remove agent from agentOpencodePorts
            const { [agentKey]: _removedPort, ...remainingPorts } = state.agentOpencodePorts;
            // Remove agent from agentMessages
            const { [agentKey]: _removedMessages, ...remainingMessages } = state.agentMessages;
            // Remove agent from agentLoading
            const { [agentKey]: _removedLoading, ...remainingLoading } = state.agentLoading;
            
            return {
              tasks: state.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, agents: t.agents.filter((a) => a.id !== agentId) }
                  : t
              ),
              activeAgentId: state.activeAgentId === agentId ? null : state.activeAgentId,
              agentOpencodePorts: remainingPorts,
              agentMessages: remainingMessages,
              agentLoading: remainingLoading,
              isLoading: false,
            };
          });
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      acceptAgent: async (taskId, agentId) => {
        set({ isLoading: true, error: null });
        try {
          await commands.acceptAgent(taskId, agentId);
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    agents: t.agents.map((a) => ({
                      ...a,
                      accepted: a.id === agentId,
                    })),
                  }
                : t
            ),
            isLoading: false,
          }));
          toast.success('Agent accepted');
        } catch (err) {
          const errorMsg = String(err);
          set({ error: errorMsg, isLoading: false });
          toast.error('Failed to accept agent', { description: errorMsg });
        }
      },

      cleanupUnacceptedAgents: async (taskId) => {
        set({ isLoading: true, error: null });
        try {
          // Stop all unaccepted agents first
          const { tasks } = get();
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            for (const agent of task.agents) {
              if (!agent.accepted) {
                try {
                  await commands.stopAgentOpencode(taskId, agent.id);
                } catch {
                  // Ignore
                }
                // Clean up per-agent client
                const agentKey = getAgentKey(taskId, agent.id);
                opencodeClientManager.removeClient(agentKey);
              }
            }
          }

          await commands.cleanupUnacceptedAgents(taskId);
          
          // Clean up state for removed agents
          const { agentOpencodePorts, agentMessages, agentLoading } = get();
          const remainingAgentIds = new Set(
            tasks.find((t) => t.id === taskId)?.agents.filter((a) => a.accepted).map((a) => a.id) || []
          );
          
          const cleanedPorts: Record<string, number> = {};
          const cleanedMessages: Record<string, OpenCodeMessage[]> = {};
          const cleanedLoading: Record<string, boolean> = {};
          
          for (const key of Object.keys(agentOpencodePorts)) {
            const [keyTaskId, keyAgentId] = key.split(':');
            if (keyTaskId !== taskId || remainingAgentIds.has(keyAgentId)) {
              cleanedPorts[key] = agentOpencodePorts[key];
            }
          }
          for (const key of Object.keys(agentMessages)) {
            const [keyTaskId, keyAgentId] = key.split(':');
            if (keyTaskId !== taskId || remainingAgentIds.has(keyAgentId)) {
              cleanedMessages[key] = agentMessages[key];
            }
          }
          for (const key of Object.keys(agentLoading)) {
            const [keyTaskId, keyAgentId] = key.split(':');
            if (keyTaskId !== taskId || remainingAgentIds.has(keyAgentId)) {
              cleanedLoading[key] = agentLoading[key];
            }
          }
          
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, agents: t.agents.filter((a) => a.accepted) }
                : t
            ),
            agentOpencodePorts: cleanedPorts,
            agentMessages: cleanedMessages,
            agentLoading: cleanedLoading,
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      // ============ Agent Execution ============

      startAgent: async (taskId, agentId, initialPrompt) => {
        const { tasks } = get();
        const task = tasks.find((t) => t.id === taskId);
        const agent = task?.agents.find((a) => a.id === agentId);

        if (!task || !agent) {
          set({ error: 'Task or agent not found' });
          return;
        }

        const agentKey = getAgentKey(taskId, agentId);

        set((state) => ({
          agentLoading: { ...state.agentLoading, [agentKey]: true },
        }));

        try {
          // Start OpenCode server for this agent
          const port = await commands.startAgentOpencode(taskId, agentId);

          set((state) => ({
            agentOpencodePorts: { ...state.agentOpencodePorts, [agentKey]: port },
          }));

          // Connect to the server and wait for it to be ready
          opencodeClient.connect(port);
          const isReady = await opencodeClient.waitForReady();
          if (!isReady) {
            throw new Error('OpenCode server did not become ready');
          }

          // CRITICAL: Establish SSE connection BEFORE creating session and sending prompt
          // This ensures we don't miss any events (race condition fix)
          await opencodeClientManager.establishSSEConnection(agentKey, port);

          // Always create a new session for fresh execution
          // This ensures we don't load old messages from previous runs
          // Include timestamp for easy identification in OpenCode's session list
          const session = await opencodeClient.createSession(
            `${task.name} - ${agent.modelId} - ${new Date().toLocaleString()}`
          );
          const sessionId = session.id;

          // Clear any existing messages in local state for this agent
          set((state) => ({
            agentMessages: { ...state.agentMessages, [agentKey]: [] },
          }));

          // Update agent with session ID and status
          await commands.updateAgentSession(taskId, agentId, sessionId);
          await commands.updateAgentStatus(taskId, agentId, 'running' as AgentStatus);

          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    agents: t.agents.map((a) =>
                      a.id === agentId ? { ...a, sessionId, status: 'running' as AgentStatus } : a
                    ),
                  }
                : t
            ),
          }));

          // Add user message
          const userMessage: OpenCodeMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: initialPrompt,
            timestamp: new Date(),
          };

          set((state) => ({
            agentMessages: {
              ...state.agentMessages,
              [agentKey]: [...(state.agentMessages[agentKey] || []), userMessage],
            },
          }));

          // Send the prompt asynchronously - response will come via SSE
          const modelString = `${agent.providerId}/${agent.modelId}`;
          await sendMessageAsync(port, sessionId, initialPrompt, {
            model: modelString,
            agent: agent.agentType || task.agentType,
          });

          // Note: Loading state will be managed by SSE hook when message.completed arrives
          // Status will be updated when task is manually stopped or all agents complete
        } catch (err) {
          console.error(`[AgentManager] Failed to start agent ${agentId}:`, err);
          const errorMsg = String(err);
          set((state) => ({
            agentLoading: { ...state.agentLoading, [agentKey]: false },
            error: errorMsg,
          }));
          toast.error('Failed to start agent', { description: errorMsg });

          // Update agent status to failed
          try {
            await commands.updateAgentStatus(taskId, agentId, 'failed' as AgentStatus);
            set((state) => ({
              tasks: state.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      agents: t.agents.map((a) =>
                        a.id === agentId ? { ...a, status: 'failed' as AgentStatus } : a
                      ),
                    }
                  : t
              ),
            }));
          } catch {
            // Ignore
          }
        }
      },

      stopAgent: async (taskId, agentId) => {
        const { tasks } = get();
        const task = tasks.find((t) => t.id === taskId);
        const agent = task?.agents.find((a) => a.id === agentId);
        const agentKey = getAgentKey(taskId, agentId);

        if (agent?.sessionId) {
          try {
            await opencodeClient.abortSession(agent.sessionId);
          } catch (err) {
            console.error('[AgentManager] Failed to abort session:', err);
          }
        }

        try {
          await commands.stopAgentOpencode(taskId, agentId);
        } catch {
          // Ignore
        }

        await commands.updateAgentStatus(taskId, agentId, 'completed' as AgentStatus);

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  agents: t.agents.map((a) =>
                    a.id === agentId ? { ...a, status: 'completed' as AgentStatus } : a
                  ),
                }
              : t
          ),
          agentLoading: { ...state.agentLoading, [agentKey]: false },
        }));
      },

      markAgentIdle: async (taskId: string, agentId: string) => {
        const { tasks } = get();

        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        const agent = task.agents.find((a) => a.id === agentId);
        if (!agent || agent.status !== 'running') return; // Only transition from running

        try {
          await commands.updateAgentStatus(taskId, agentId, 'idle' as AgentStatus);

          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    agents: t.agents.map((a) =>
                      a.id === agentId ? { ...a, status: 'idle' as AgentStatus } : a
                    ),
                  }
                : t
            ),
          }));

          // Check if all agents in task are now idle/completed
          get().updateTaskStatusFromAgents(taskId);
        } catch (err) {
          console.error(`[AgentManager] Failed to mark agent ${agentId} as idle:`, err);
        }
      },

      updateTaskStatusFromAgents: async (taskId: string) => {
        const { tasks } = get();
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        // Determine task status based on agent statuses
        const allIdle = task.agents.every((a) => a.status === 'idle');
        const allCompleted = task.agents.every(
          (a) => a.status === 'completed' || a.status === 'failed'
        );
        const anyRunning = task.agents.some((a) => a.status === 'running');
        const anyFailed = task.agents.some((a) => a.status === 'failed');

        let newStatus: 'idle' | 'running' | 'completed' | 'failed';

        if (anyRunning) {
          newStatus = 'running';
        } else if (allCompleted) {
          newStatus = anyFailed ? 'failed' : 'completed';
        } else if (allIdle) {
          newStatus = 'idle';
        } else {
          // Mixed states - default to idle
          newStatus = 'idle';
        }

        if (task.status !== newStatus) {
          try {
            await commands.updateTask(taskId, undefined, newStatus as any);
            set((state) => ({
              tasks: state.tasks.map((t) =>
                t.id === taskId ? { ...t, status: newStatus as any } : t
              ),
            }));
          } catch (err) {
            console.error(`[AgentManager] Failed to update task status:`, err);
          }
        }
      },

      // ============ Task Execution (All Agents) ============

      startTask: async (taskId, initialPrompt) => {
        const { tasks } = get();
        const task = tasks.find((t) => t.id === taskId);

        if (!task) {
          set({ error: 'Task not found' });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Update task status
          await commands.updateTask(taskId, undefined, 'running' as any);
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, status: 'running' as any } : t
            ),
          }));

          // Start all agents in parallel
          const startPromises = task.agents.map((agent) =>
            get().startAgent(taskId, agent.id, initialPrompt)
          );

          await Promise.allSettled(startPromises);

          // Update task status based on agent statuses
          const updatedTask = await commands.getTask(taskId);
          const allCompleted = updatedTask.agents.every(
            (a) => a.status === 'completed' || a.status === 'failed'
          );
          const anyFailed = updatedTask.agents.some((a) => a.status === 'failed');

          const finalStatus = allCompleted
            ? anyFailed
              ? 'failed'
              : 'completed'
            : 'running';

          await commands.updateTask(taskId, undefined, finalStatus as any);

          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, status: finalStatus as any } : t
            ),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      stopTask: async (taskId) => {
        const { tasks } = get();
        const task = tasks.find((t) => t.id === taskId);

        if (!task) return;

        // Stop all agents
        for (const agent of task.agents) {
          await get().stopAgent(taskId, agent.id);
        }

        // Stop all OpenCode servers
        await commands.stopTaskAllOpencode(taskId);

        await commands.updateTask(taskId, undefined, 'completed' as any);

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'completed' as any } : t
          ),
        }));
      },

      // ============ Follow-ups ============

      sendFollowUp: async (taskId, prompt, targetAgentIds) => {
        const { tasks, agentOpencodePorts } = get();
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        const agents = targetAgentIds
          ? task.agents.filter((a) => targetAgentIds.includes(a.id))
          : task.agents;

        for (const agent of agents) {
          if (!agent.sessionId) continue;

          const agentKey = getAgentKey(taskId, agent.id);
          const port = agentOpencodePorts[agentKey];
          if (!port) continue;

          set((state) => ({
            agentLoading: { ...state.agentLoading, [agentKey]: true },
          }));

          try {
            // Add user message
            const userMessage: OpenCodeMessage = {
              id: Date.now().toString(),
              role: 'user',
              content: prompt,
              timestamp: new Date(),
            };

            set((state) => ({
              agentMessages: {
                ...state.agentMessages,
                [agentKey]: [...(state.agentMessages[agentKey] || []), userMessage],
              },
            }));

            // Send asynchronously - response will come via SSE
            const modelString = `${agent.providerId}/${agent.modelId}`;
            await sendMessageAsync(port, agent.sessionId, prompt, {
              model: modelString,
            });

            // Note: Loading state will be managed by SSE hook when message.completed arrives
          } catch (err) {
            console.error(`[AgentManager] Failed to send follow-up to ${agent.id}:`, err);
            const errorMsg = String(err);
            set((state) => ({
              agentLoading: { ...state.agentLoading, [agentKey]: false },
              error: `Failed to send message: ${errorMsg}`,
            }));
            toast.error('Failed to send message', { description: errorMsg });
          }
        }
      },

      // ============ OpenCode Data ============

      loadProviders: async (port): Promise<OpenCodeProvider[]> => {
        try {
          opencodeClient.connect(port);
          
          // Wait for server to be ready
          const isReady = await opencodeClient.waitForReady();
          if (!isReady) {
            toast.error('OpenCode server not ready');
            return [];
          }
          
          const data = await opencodeClient.getProviders();
          set({ providers: data.providers });
          return data.providers;
        } catch (err) {
          console.error('[AgentManager] Failed to load providers:', err);
          toast.error('Failed to load AI providers', { 
            description: String(err) 
          });
          return [];
        }
      },

      loadAvailableAgents: async (port): Promise<OpenCodeAgentConfig[]> => {
        try {
          opencodeClient.connect(port);
          const agents = await opencodeClient.getAgents();
          // Map to OpenCodeAgentConfig format
          const agentConfigs: OpenCodeAgentConfig[] = agents.map(a => ({
            id: a.id || a.name,
            name: a.name,
            description: a.description,
            mode: a.mode,
          }));
          set({ availableAgents: agentConfigs });
          return agentConfigs;
        } catch (err) {
          console.error('[AgentManager] Failed to load agents:', err);
          toast.error('Failed to load agents', { 
            description: String(err) 
          });
          return [];
        }
      },

      refreshOpenCodeData: async (repoPath: string) => {
        set({ isLoadingOpenCodeData: true });
        try {
          // Start a temporary OpenCode server
          const port = await commands.startOpencode(repoPath);
          opencodeClient.connect(port);
          
          // Wait for server to be ready
          const isReady = await opencodeClient.waitForReady();
          if (!isReady) {
            throw new Error('OpenCode server did not become ready');
          }
          
          // Load both providers and agents
          const providersData = await opencodeClient.getProviders();
          const agents = await opencodeClient.getAgents();
          
          const agentConfigs: OpenCodeAgentConfig[] = agents.map(a => ({
            id: a.id || a.name,
            name: a.name,
            description: a.description,
            mode: a.mode,
          }));
          
          set({ 
            providers: providersData.providers, 
            availableAgents: agentConfigs,
            isLoadingOpenCodeData: false,
          });
          
          toast.success('Providers and agents refreshed');
        } catch (err) {
          console.error('[AgentManager] Failed to refresh OpenCode data:', err);
          set({ isLoadingOpenCodeData: false });
          toast.error('Failed to refresh providers and agents', { 
            description: String(err) 
          });
        }
      },

      // ============ Navigation ============

      setActiveTask: (taskId) => {
        const { tasks } = get();
        const task = tasks.find((t) => t.id === taskId);
        set({
          activeTaskId: taskId,
          activeAgentId: task?.agents[0]?.id || null,
        });
        
        // Trigger recovery for agents with sessions but no running OpenCode
        if (task) {
          get().recoverTaskAgents(task.id);
        }
      },

      setActiveAgent: (agentId) => {
        const { activeTaskId } = get();
        set({ activeAgentId: agentId });
        
        // Trigger recovery for the newly selected agent
        if (activeTaskId && agentId) {
          get().recoverTaskAgents(activeTaskId);
        }
      },
      
      // ============ OpenCode Server Recovery ============
       
       recoverTaskAgents: async (taskId) => {
         const { tasks, agentOpencodePorts, agentMessages, orphanedAgents } = get();
         const task = tasks.find((t) => t.id === taskId);
         if (!task) {
           return;
         }
         
         const orphanedIds = orphanedAgents[taskId] || [];
         
         // Recover ALL agents with sessions, not just the active one
         // This ensures chat history is available when switching between agents
         const agentsToRecover = task.agents.filter(a => a.sessionId);
         
         for (const agent of agentsToRecover) {
           // Skip orphaned agents
           if (orphanedIds.includes(agent.id)) {
             continue;
           }
           
           const agentKey = getAgentKey(taskId, agent.id);
           
           // Issue 2 fix: Check if this agent is already being recovered (race condition guard)
           if (agentsBeingRecovered.has(agentKey)) {
             console.log('[recoverTaskAgents] Agent already being recovered, skipping:', agentKey);
             continue;
           }
           
           // Issue 4 fix: Skip if we already have assistant messages (meaning we've recovered/streamed)
           // Only check for assistant messages - user messages are added locally before API call
           // so their presence doesn't mean we have the full conversation
           const existingMessages = agentMessages[agentKey];
           const hasAssistantMessages = existingMessages?.some(m => m.role === 'assistant');
           if (hasAssistantMessages) {
             // Still need to ensure port is set for SSE, but don't re-fetch messages
             const existingPort = agentOpencodePorts[agentKey];
             if (!existingPort) {
               try {
                 let port = await commands.getAgentOpencodePort(taskId, agent.id);
                 if (!port) {
                   port = await commands.startAgentOpencode(taskId, agent.id);
                 }
                 set((state) => ({
                   agentOpencodePorts: { ...state.agentOpencodePorts, [agentKey]: port },
                 }));
                 
                 // Also establish SSE connection if not already connected
                 if (!opencodeClientManager.isSSEConnected(agentKey)) {
                   try {
                     await opencodeClientManager.establishSSEConnection(agentKey, port);
                   } catch (err) {
                     console.warn(`[recoverTaskAgents] Failed to establish SSE for ${agent.id}:`, err);
                   }
                 }
               } catch (err) {
                 console.error(`[recoverTaskAgents] Failed to get port for ${agent.id}:`, err);
               }
             }
             continue;
           }
           
           // Mark agent as being recovered to prevent race conditions
           agentsBeingRecovered.add(agentKey);
           
           // Check if server is running via backend
           try {
             let port = await commands.getAgentOpencodePort(taskId, agent.id);
             let serverWasStarted = false;
             
             if (!port) {
               // Server not running, start it
               port = await commands.startAgentOpencode(taskId, agent.id);
               serverWasStarted = true;
             }
             
             // Store the port
             set((state) => ({
               agentOpencodePorts: { ...state.agentOpencodePorts, [agentKey]: port },
             }));
             
             // Connect and wait for server to be ready
             opencodeClient.connect(port);
             const isReady = await opencodeClient.waitForReady();
             if (!isReady) {
               console.error('[recoverTaskAgents] Server not ready for agent:', agent.id);
               agentsBeingRecovered.delete(agentKey);
               continue;
             }
             
             // Establish SSE connection for recovery
             try {
               await opencodeClientManager.establishSSEConnection(agentKey, port);
             } catch (err) {
               console.warn('[recoverTaskAgents] Failed to establish SSE for agent:', agent.id, err);
               // Continue anyway - SSE will be established by the hook if needed
             }
             
            // Load messages from the session using extended API to get parts
            // Note: agent.sessionId is guaranteed to exist here because we filter by it above
            console.log('[recoverTaskAgents] Loading messages for session:', agent.sessionId);
            opencodeClient.setSession(agent.sessionId!);
            const extendedMessages = await opencodeClient.getSessionMessagesExtended();
            console.log('[recoverTaskAgents] Extended messages count:', extendedMessages.length);
            
            // Convert extended messages to standard format with properly extracted content
            const messages = extendedToStandardMessages(extendedMessages);
            console.log('[recoverTaskAgents] Converted messages:', messages.length);
            
            // Deduplicate messages by ID to prevent showing duplicates
            const uniqueMessages = messages.filter((msg, index, self) =>
              index === self.findIndex((m) => m.id === msg.id)
            );
            console.log('[recoverTaskAgents] Unique messages:', uniqueMessages.length);
            
            set((state) => ({
              agentMessages: { ...state.agentMessages, [agentKey]: uniqueMessages },
              // Reset loading state since recovery is complete
              agentLoading: { ...state.agentLoading, [agentKey]: false },
            }));
            console.log('[recoverTaskAgents] Store updated for key:', agentKey);
             
             if (serverWasStarted) {
               toast.info('Session restored', {
                 description: `Reconnected to ${agent.modelId}`,
               });
             }
             
             // Clear the recovery guard on success
             agentsBeingRecovered.delete(agentKey);
           } catch (err) {
             console.error(`[recoverTaskAgents] Failed to recover agent ${agent.id}:`, err);
             // Clear the recovery guard on failure
             agentsBeingRecovered.delete(agentKey);
           }
         }
       },

      // ============ Messages ============

      loadAgentMessages: async (taskId, agentId) => {
        const { tasks, agentOpencodePorts } = get();
        const task = tasks.find((t) => t.id === taskId);
        const agent = task?.agents.find((a) => a.id === agentId);

        if (!agent?.sessionId) return;

        const agentKey = getAgentKey(taskId, agentId);
        const port = agentOpencodePorts[agentKey];
        if (!port) return;

        try {
          opencodeClient.connect(port);
          opencodeClient.setSession(agent.sessionId);
          const extendedMessages = await opencodeClient.getSessionMessagesExtended();
          console.log('[loadAgentMessages] Extended messages:', extendedMessages.length);
          console.log('[loadAgentMessages] Detail:', JSON.stringify(extendedMessages.map(m => ({
            id: m.id,
            role: m.role,
            partsCount: m.parts?.length,
            content: extractContentFromParts(m.parts || [])
          })), null, 2));
          
          // Convert using the same helper
          const messages = extendedToStandardMessages(extendedMessages);
          
          // Deduplicate messages by ID
          const uniqueMessages = messages.filter((msg, index, self) =>
            index === self.findIndex((m) => m.id === msg.id)
          );
          
          set((state) => ({
            agentMessages: { ...state.agentMessages, [agentKey]: uniqueMessages },
          }));
        } catch (err) {
          console.error('[AgentManager] Failed to load messages:', err);
        }
      },

      clearAgentMessages: (taskId, agentId) => {
        const agentKey = getAgentKey(taskId, agentId);
        set((state) => ({
          agentMessages: { ...state.agentMessages, [agentKey]: [] },
        }));
      },

      addAgentMessage: (taskId, agentId, message) => {
        const agentKey = getAgentKey(taskId, agentId);
        set((state) => ({
          agentMessages: {
            ...state.agentMessages,
            [agentKey]: [...(state.agentMessages[agentKey] || []), message],
          },
        }));
      },

      // ============ Error Handling ============

      clearError: () => {
        set({ error: null });
      },

      setError: (error) => {
        set({ error });
      },

      // ============ Orphaned Agent Handling ============

      validateTaskWorktrees: async (taskId) => {
        try {
          const orphanedIds = await commands.validateTaskWorktrees(taskId);
          set((state) => ({
            orphanedAgents: {
              ...state.orphanedAgents,
              [taskId]: orphanedIds,
            },
          }));
          
          if (orphanedIds.length > 0) {
            toast.warning('Orphaned agents detected', {
              description: `${orphanedIds.length} agent(s) have missing worktrees`,
            });
          }
          
          return orphanedIds;
        } catch (err) {
          console.error('[AgentManager] Failed to validate worktrees:', err);
          return [];
        }
      },

      recreateAgentWorktree: async (taskId, agentId) => {
        try {
          await commands.recreateAgentWorktree(taskId, agentId);
          
          // Remove from orphaned list
          set((state) => ({
            orphanedAgents: {
              ...state.orphanedAgents,
              [taskId]: (state.orphanedAgents[taskId] || []).filter((id) => id !== agentId),
            },
          }));
          
          toast.success('Worktree recreated', {
            description: 'Agent worktree has been restored',
          });
        } catch (err) {
          const errorMsg = String(err);
          toast.error('Failed to recreate worktree', { description: errorMsg });
          throw err;
        }
      },

      isAgentOrphaned: (taskId, agentId) => {
        const { orphanedAgents } = get();
        return orphanedAgents[taskId]?.includes(agentId) || false;
      },
    }),
    {
      name: 'aristar-agent-manager-store',
      partialize: (state) => ({
        tasks: state.tasks,
        activeTaskId: state.activeTaskId,
        activeAgentId: state.activeAgentId,
        providers: state.providers,
        availableAgents: state.availableAgents,
      }),
    }
  )
);
