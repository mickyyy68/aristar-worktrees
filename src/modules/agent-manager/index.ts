// Agent Manager Module - AI agent orchestration and management

// Components
export * from './components';

// API (selective exports to avoid duplicates with store)
export { opencodeClient, useAgentSSE, sendMessageAsync } from './api';
export type {
  OpenCodeMessage,
  OpenCodeSession,
  OpenCodeAgentInfo,
  MessagePart,
  TextPart,
  ToolInvocationPart,
  OpenCodeMessageExtended,
  StreamingMessage,
} from './api';

// Store (has its own OpenCodeModel and OpenCodeProvider types)
export { useAgentManagerStore } from './store';
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
  OpenCodeSSEEvent,
  MessagePartDeltaEvent,
  MessageCreatedEvent,
  MessageCompletedEvent,
  SessionUpdatedEvent,
} from './store';
