import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Task,
  OpenCodeProvider,
  OpenCodeAgentConfig,
  CreateTaskParams,
  ModelSelection,
  AgentStatus,
} from '@/store/types';
import type { OpenCodeMessage } from '@/lib/opencode';
import { opencodeClient } from '@/lib/opencode';
import * as commands from '@/lib/commands';

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
  error: string | null;

  // Per-agent chat state
  agentMessages: Record<string, OpenCodeMessage[]>; // agentId -> messages
  agentLoading: Record<string, boolean>;

  // OpenCode connection state per agent
  agentOpencodePorts: Record<string, number>; // agentId -> port
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
  loadProviders: (port: number) => Promise<void>;
  loadAvailableAgents: (port: number) => Promise<void>;

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
      error: null,
      agentMessages: {},
      agentLoading: {},
      agentOpencodePorts: {},

      // ============ Task CRUD ============

      loadTasks: async () => {
        set({ isLoading: true, error: null });
        try {
          const tasks = await commands.getTasks();
          set({ tasks, isLoading: false });
        } catch (err) {
          set({ error: String(err), isLoading: false });
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
          return task;
        } catch (err) {
          set({ error: String(err), isLoading: false });
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
        } catch (err) {
          set({ error: String(err), isLoading: false });
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
        } catch (err) {
          set({ error: String(err), isLoading: false });
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

          // Connect to the server
          opencodeClient.connect(port);

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

          // Send the prompt with model info
          const modelString = `${agent.providerId}/${agent.modelId}`;
          const response = await opencodeClient.sendPromptWithOptions(initialPrompt, {
            model: modelString,
            agent: agent.agentType || task.agentType,
          });

          // Add response
          set((state) => ({
            agentMessages: {
              ...state.agentMessages,
              [agentId]: [...(state.agentMessages[agentId] || []), response],
            },
            agentLoading: { ...state.agentLoading, [agentId]: false },
          }));

          // Update agent status to completed
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
          }));
        } catch (err) {
          console.error(`[AgentManager] Failed to start agent ${agentId}:`, err);
          set((state) => ({
            agentLoading: { ...state.agentLoading, [agentId]: false },
            error: String(err),
          }));

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
            // Connect to the right server
            opencodeClient.connect(port);
            opencodeClient.setSession(agent.sessionId);

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

            const modelString = `${agent.providerId}/${agent.modelId}`;
            const response = await opencodeClient.sendPromptWithOptions(prompt, {
              model: modelString,
            });

            set((state) => ({
              agentMessages: {
                ...state.agentMessages,
                [agent.id]: [...(state.agentMessages[agent.id] || []), response],
              },
              agentLoading: { ...state.agentLoading, [agent.id]: false },
            }));
          } catch (err) {
            console.error(`[AgentManager] Failed to send follow-up to ${agent.id}:`, err);
            set((state) => ({
              agentLoading: { ...state.agentLoading, [agent.id]: false },
            }));
          }
        }
      },

      // ============ OpenCode Data ============

      loadProviders: async (port) => {
        try {
          opencodeClient.connect(port);
          const data = await opencodeClient.getProviders();
          set({ providers: data.providers });
        } catch (err) {
          console.error('[AgentManager] Failed to load providers:', err);
        }
      },

      loadAvailableAgents: async (port) => {
        try {
          opencodeClient.connect(port);
          const agents = await opencodeClient.getAgents();
          set({ availableAgents: agents });
        } catch (err) {
          console.error('[AgentManager] Failed to load agents:', err);
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
      },

      setActiveAgent: (agentId) => {
        set({ activeAgentId: agentId });
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
    }),
    {
      name: 'aristar-agent-manager-store',
      partialize: (state) => ({
        tasks: state.tasks,
        activeTaskId: state.activeTaskId,
        activeAgentId: state.activeAgentId,
      }),
    }
  )
);
