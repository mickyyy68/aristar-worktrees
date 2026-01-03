/**
 * Agent Manager Hooks
 *
 * Read-only React hooks for accessing agent manager state.
 * These hooks don't manage subscriptions - just read from stores.
 */

export { useAgentMessages, useAgentMessagesById } from './use-agent-messages';
export type { UseAgentMessagesResult } from './use-agent-messages';
