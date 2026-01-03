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
} from './types';
import type { OpenCodeMessage } from '../api/opencode';
import { opencodeClient } from '../api/opencode';
import { commands } from '@core/lib';
import { sendMessageAsync } from '../api/use-agent-sse';

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

  // Per-agent chat state
  agentMessages: Record<string, OpenCodeMessage[]>; // agentId -> messages
  agentLoading: Record<string, boolean>;

  // OpenCode connection state per agent
  agentOpencodePorts: Record<string, number>; // agentId -> port

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
  clearAgentMessages: (agentId: string) => void;
  addAgentMessage: (agentId: string, message: OpenCodeMessage) => void;

  // Error handling
  clearError: () => void;
  setError: (error: string) => void;

  // Orphaned agent handling
  validateTaskWorktrees: (taskId: string) => Promise<string[]>;
  recreateAgentWorktree: (taskId: string, agentId: string) => Promise<void>;
  isAgentOrphaned: (taskId: string, agentId: string) => boolean;

  // OpenCode server recovery
  recoverTaskAgents: (taskId: string) => Promise<void>;
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
          set({ tasks, isLoading: false });
          
          // Validate worktrees for all tasks
          const orphanedAgents: Record<string, string[]> = {};
          for (const task of tasks) {
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
        } catch (err) {
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
          // Stop all OpenCode servers for this task first
          await commands.stopTaskAllOpencode(taskId);

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
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, agents: t.agents.filter((a) => a.id !== agentId) }
                : t
            ),
            activeAgentId: state.activeAgentId === agentId ? null : state.activeAgentId,
            isLoading: false,
          }));
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
              }
            }
          }

          await commands.cleanupUnacceptedAgents(taskId);
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, agents: t.agents.filter((a) => a.accepted) }
                : t
            ),
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

        set((state) => ({
          agentLoading: { ...state.agentLoading, [agentId]: true },
        }));

        try {
          // Start OpenCode server for this agent
          const port = await commands.startAgentOpencode(taskId, agentId);

          set((state) => ({
            agentOpencodePorts: { ...state.agentOpencodePorts, [agentId]: port },
          }));

          // Connect to the server and wait for it to be ready
          opencodeClient.connect(port);
          const isReady = await opencodeClient.waitForReady();
          if (!isReady) {
            throw new Error('OpenCode server did not become ready');
          }

          // Create or get session
          const sessions = await opencodeClient.listSessions();
          let sessionId = sessions[0]?.id || null;

          if (!sessionId) {
            const session = await opencodeClient.createSession(`${task.name} - ${agent.modelId}`);
            sessionId = session.id;
          } else {
            opencodeClient.setSession(sessionId);
          }

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
              [agentId]: [...(state.agentMessages[agentId] || []), userMessage],
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
            agentLoading: { ...state.agentLoading, [agentId]: false },
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
          agentLoading: { ...state.agentLoading, [agentId]: false },
        }));
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

          const port = agentOpencodePorts[agent.id];
          if (!port) continue;

          set((state) => ({
            agentLoading: { ...state.agentLoading, [agent.id]: true },
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
                [agent.id]: [...(state.agentMessages[agent.id] || []), userMessage],
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
              agentLoading: { ...state.agentLoading, [agent.id]: false },
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
            id: a.id,
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
            id: a.id,
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
        set({ activeAgentId: agentId });
      },
      
      // ============ OpenCode Server Recovery ============
      
      recoverTaskAgents: async (taskId) => {
        const { tasks, agentOpencodePorts, orphanedAgents } = get();
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;
        
        const orphanedIds = orphanedAgents[taskId] || [];
        
        for (const agent of task.agents) {
          // Skip orphaned agents
          if (orphanedIds.includes(agent.id)) continue;
          
          // Skip agents without sessions (never started)
          if (!agent.sessionId) continue;
          
          // Check if OpenCode is already running
          const existingPort = agentOpencodePorts[agent.id];
          if (existingPort) continue;
          
          // Check if server is running via backend
          try {
            const port = await commands.getAgentOpencodePort(taskId, agent.id);
            if (port) {
              // Server is running, just store the port
              set((state) => ({
                agentOpencodePorts: { ...state.agentOpencodePorts, [agent.id]: port },
              }));
              
              // Load messages from the session
              opencodeClient.connect(port);
              opencodeClient.setSession(agent.sessionId);
              const messages = await opencodeClient.getSessionMessages();
              set((state) => ({
                agentMessages: { ...state.agentMessages, [agent.id]: messages },
              }));
            } else {
              // Server not running, start it and restore session
              const newPort = await commands.startAgentOpencode(taskId, agent.id);
              set((state) => ({
                agentOpencodePorts: { ...state.agentOpencodePorts, [agent.id]: newPort },
              }));
              
              // Connect and restore session
              opencodeClient.connect(newPort);
              opencodeClient.setSession(agent.sessionId);
              const messages = await opencodeClient.getSessionMessages();
              set((state) => ({
                agentMessages: { ...state.agentMessages, [agent.id]: messages },
              }));
              
              toast.info('Session restored', {
                description: `Reconnected to ${agent.modelId}`,
              });
            }
          } catch (err) {
            console.error(`[AgentManager] Failed to recover agent ${agent.id}:`, err);
          }
        }
      },

      // ============ Messages ============

      loadAgentMessages: async (taskId, agentId) => {
        const { tasks, agentOpencodePorts } = get();
        const task = tasks.find((t) => t.id === taskId);
        const agent = task?.agents.find((a) => a.id === agentId);

        if (!agent?.sessionId) return;

        const port = agentOpencodePorts[agentId];
        if (!port) return;

        try {
          opencodeClient.connect(port);
          opencodeClient.setSession(agent.sessionId);
          const messages = await opencodeClient.getSessionMessages();
          set((state) => ({
            agentMessages: { ...state.agentMessages, [agentId]: messages },
          }));
        } catch (err) {
          console.error('[AgentManager] Failed to load messages:', err);
        }
      },

      clearAgentMessages: (agentId) => {
        set((state) => ({
          agentMessages: { ...state.agentMessages, [agentId]: [] },
        }));
      },

      addAgentMessage: (agentId, message) => {
        set((state) => ({
          agentMessages: {
            ...state.agentMessages,
            [agentId]: [...(state.agentMessages[agentId] || []), message],
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
