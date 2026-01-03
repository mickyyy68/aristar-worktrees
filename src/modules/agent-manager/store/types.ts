// Agent Manager Types
// Types for the Agent Manager feature that allows running multiple AI agents in parallel

// ============ Status Types ============

export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

// ============ Task Agent ============

/**
 * Represents one AI model/agent working on a task.
 * Each agent has its own worktree and OpenCode session.
 */
export interface TaskAgent {
  /** Unique ID within task (e.g., "agent-1") */
  id: string;
  /** Model ID (e.g., "claude-sonnet-4") */
  modelId: string;
  /** Provider ID (e.g., "anthropic") */
  providerId: string;
  /** Override task's default agent type */
  agentType?: string;
  /** Full path to agent's worktree */
  worktreePath: string;
  /** OpenCode session ID */
  sessionId?: string;
  /** Current status */
  status: AgentStatus;
  /** Whether this agent's output was accepted as the winner */
  accepted: boolean;
  /** Timestamp when agent was created */
  createdAt: number;
}

// ============ Task ============

/**
 * A task represents a goal/prompt with multiple agents working on it.
 * Each task has its own folder with agent worktrees inside.
 */
export interface Task {
  /** Unique 8-char hash (e.g., "a1b2c3d4") */
  id: string;
  /** User-friendly name */
  name: string;
  /** Source type: branch or commit */
  sourceType: 'branch' | 'commit';
  /** Source branch name (when sourceType is 'branch') */
  sourceBranch?: string;
  /** Source commit hash (when sourceType is 'commit') */
  sourceCommit?: string;
  /** Original repository path */
  sourceRepoPath: string;
  /** Default agent type for all agents (e.g., "build") */
  agentType: string;
  /** Current task status */
  status: TaskStatus;
  /** Timestamp when task was created */
  createdAt: number;
  /** Timestamp when task was last updated */
  updatedAt: number;
  /** List of agents working on this task */
  agents: TaskAgent[];
}

// ============ OpenCode Types ============

/**
 * Model information from OpenCode
 */
export interface OpenCodeModel {
  id: string;
  name: string;
  limit?: {
    context?: number;
    output?: number;
  };
}

/**
 * Provider information from OpenCode
 */
export interface OpenCodeProvider {
  id: string;
  name: string;
  models: OpenCodeModel[];
}

/**
 * Agent configuration from OpenCode
 */
export interface OpenCodeAgentConfig {
  id: string;
  name: string;
  description: string;
  mode: 'primary' | 'subagent' | 'all';
}

// ============ Request/Params Types ============

/**
 * Model selection for creating agents
 */
export interface ModelSelection {
  providerId: string;
  modelId: string;
}

/**
 * Parameters for creating a new task
 */
export interface CreateTaskParams {
  name: string;
  sourceType: 'branch' | 'commit';
  sourceBranch?: string;
  sourceCommit?: string;
  sourceRepoPath: string;
  agentType: string;
  models: ModelSelection[];
}

// ============ Message Part Types ============

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocationId: string;
  toolName: string;
  state: 'pending' | 'running' | 'result' | 'error' | 'completed';
  args?: unknown;
  result?: unknown;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolInvocationId: string;
  result: unknown;
}

export type MessagePart = TextPart | ToolInvocationPart | ToolResultPart | { type: string; [key: string]: unknown };

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

// ============ SSE Event Types ============

/**
 * SSE event from OpenCode /event endpoint
 */
export interface OpenCodeSSEEvent {
  type: string;
  properties?: Record<string, unknown>;
}

/**
 * Message part delta event
 */
export interface MessagePartDeltaEvent extends OpenCodeSSEEvent {
  type: 'message.part.delta';
  properties: {
    sessionID: string;
    messageID: string;
    part: MessagePart;
  };
}

/**
 * Message created event
 */
export interface MessageCreatedEvent extends OpenCodeSSEEvent {
  type: 'message.created';
  properties: {
    sessionID: string;
    info: {
      id: string;
      role: 'user' | 'assistant' | 'system';
      created: string;
    };
  };
}

/**
 * Message completed event
 */
export interface MessageCompletedEvent extends OpenCodeSSEEvent {
  type: 'message.completed';
  properties: {
    sessionID: string;
    messageID: string;
  };
}

/**
 * Session updated event (includes status changes)
 */
export interface SessionUpdatedEvent extends OpenCodeSSEEvent {
  type: 'session.updated';
  properties: {
    id: string;
    status?: 'idle' | 'running' | 'pending';
  };
}

/**
 * Extended message with streaming support
 */
export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  parts: MessagePart[];
  isStreaming: boolean;
}

// ============ Task Creation Preferences ============

/**
 * Per-repository task creation preferences
 */
export interface TaskCreationPreferences {
  agentType: string;
  models: ModelSelection[];
  prompt: string;
}

/**
 * All task creation preferences, keyed by repository ID
 */
export type TaskPreferencesRecord = Record<string, TaskCreationPreferences>;
