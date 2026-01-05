// Agent Manager Module - AI agent orchestration and management

// Components
export * from './components';

// API (selective exports to avoid duplicates with store)
export { opencodeClient } from './api';
export type {
  OpenCodeMessage,
  OpenCodeSession,
  OpenCodeAgentInfo,
  OpenCodeMessageExtended,
} from './api';

// New architecture - types
export type {
  Message,
  MessagePart,
  TextPart,
  ToolInvocationPart,
  ReasoningPart,
  StreamingMessage,
  SSEEvent,
  OpenCodeSSEEvent,
} from './api/opencode-types';

// New architecture - hooks
export { useAgentMessages, useAgentMessagesById } from './hooks';
export type { UseAgentMessagesResult } from './hooks';

// New architecture - stores
export { useMessageStore } from './store/message-store';
export { sseManager } from './store/sse-manager';

// Legacy exports (deprecated - will be removed)
export { useAgentSSE, sendMessageAsync } from './api';

// Store (has its own OpenCodeModel and OpenCodeProvider types)
export { useAgentManagerStore, getAgentKey, cleanupAgentManagerResources } from './store';
export type {
  Task,
  TaskAgent,
  TaskStatus,
  AgentStatus,
  OpenCodeModel,
  OpenCodeProvider,
  OpenCodeAgentConfig,
  ModelSelection,
  CreateTaskParams,
  MessageStatus,
} from './store';
