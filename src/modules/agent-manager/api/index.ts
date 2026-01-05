// Agent Manager API

export { opencodeClient, opencodeClientManager } from './opencode';
export type {
  OpenCodeMessage,
  OpenCodeSession,
  OpenCodeModel,
  OpenCodeProvider,
  OpenCodeAgentInfo,
  OpenCodeMessageExtended,
} from './opencode';

// New architecture exports
export * from './opencode-types';

// Legacy hook (deprecated - use useAgentMessages from hooks instead)
export { useAgentSSE, sendMessageAsync } from './use-agent-sse';
export type { StreamingMessage } from './use-agent-sse';
