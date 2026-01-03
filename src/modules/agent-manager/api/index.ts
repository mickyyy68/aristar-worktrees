// Agent Manager API

export { opencodeClient, opencodeClientManager } from './opencode';
export type {
  OpenCodeMessage,
  OpenCodeSession,
  OpenCodeModel,
  OpenCodeProvider,
  OpenCodeAgentInfo,
  MessagePart,
  TextPart,
  ToolInvocationPart,
  OpenCodeMessageExtended,
} from './opencode';

export { useAgentSSE, sendMessageAsync } from './use-agent-sse';
export type { StreamingMessage } from './use-agent-sse';
