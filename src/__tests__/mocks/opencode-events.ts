/**
 * Mock OpenCode SSE events for testing
 *
 * These events are based on actual OpenCode server output.
 * Event types observed:
 * - message.updated (not message.created)
 * - message.part.updated with delta field (not message.part.delta)
 * - session.status with {type: "idle"} object
 * - session.idle
 */

export interface MockEventData {
  type: string;
  properties: Record<string, unknown>;
}

// Test session and message IDs
export const TEST_SESSION_ID = 'test-session-123';
export const TEST_MESSAGE_ID = 'msg-001';
export const TEST_AGENT_ID = 'agent-1';

/**
 * Server connected event (first event after connecting)
 */
export const serverConnectedEvent: MockEventData = {
  type: 'server.connected',
  properties: {},
};

/**
 * message.updated event - signals a new message or message update
 * This is used instead of message.created in the actual OpenCode implementation
 */
export const messageUpdatedAssistant: MockEventData = {
  type: 'message.updated',
  properties: {
    sessionID: TEST_SESSION_ID,
    info: {
      id: TEST_MESSAGE_ID,
      role: 'assistant',
      time: {
        created: '2026-01-03T12:00:00.000Z',
      },
    },
  },
};

export const messageUpdatedUser: MockEventData = {
  type: 'message.updated',
  properties: {
    sessionID: TEST_SESSION_ID,
    info: {
      id: 'msg-user-001',
      role: 'user',
      time: {
        created: '2026-01-03T11:59:00.000Z',
      },
    },
  },
};

/**
 * message.part.updated event - contains streaming text delta
 * The delta field contains the incremental text update
 */
export const messagePartUpdatedWithDelta: MockEventData = {
  type: 'message.part.updated',
  properties: {
    sessionID: TEST_SESSION_ID,
    part: {
      type: 'text',
      messageID: TEST_MESSAGE_ID,
    },
    delta: 'Hello, ',
  },
};

export const messagePartUpdatedWithDelta2: MockEventData = {
  type: 'message.part.updated',
  properties: {
    sessionID: TEST_SESSION_ID,
    part: {
      type: 'text',
      messageID: TEST_MESSAGE_ID,
    },
    delta: 'world!',
  },
};

/**
 * message.part.updated with full text (non-delta)
 * Sometimes the part contains the full text instead of a delta
 */
export const messagePartUpdatedFullText: MockEventData = {
  type: 'message.part.updated',
  properties: {
    sessionID: TEST_SESSION_ID,
    part: {
      type: 'text',
      messageID: TEST_MESSAGE_ID,
      text: 'This is the complete text.',
    },
  },
};

/**
 * session.status event with idle status as object
 * The status field is an object with a type property
 */
export const sessionStatusIdle: MockEventData = {
  type: 'session.status',
  properties: {
    sessionID: TEST_SESSION_ID,
    status: {
      type: 'idle',
    },
  },
};

export const sessionStatusRunning: MockEventData = {
  type: 'session.status',
  properties: {
    sessionID: TEST_SESSION_ID,
    status: {
      type: 'running',
    },
  },
};

export const sessionStatusBusy: MockEventData = {
  type: 'session.status',
  properties: {
    sessionID: TEST_SESSION_ID,
    status: {
      type: 'busy',
    },
  },
};

export const sessionStatusPending: MockEventData = {
  type: 'session.status',
  properties: {
    sessionID: TEST_SESSION_ID,
    status: {
      type: 'pending',
    },
  },
};

/**
 * session.idle event - alternative way to signal idle state
 */
export const sessionIdleEvent: MockEventData = {
  type: 'session.idle',
  properties: {
    sessionID: TEST_SESSION_ID,
  },
};

/**
 * Legacy message.created event (for backwards compatibility)
 */
export const legacyMessageCreated: MockEventData = {
  type: 'message.created',
  properties: {
    sessionID: TEST_SESSION_ID,
    info: {
      id: 'legacy-msg-001',
      role: 'assistant',
      created: '2026-01-03T12:00:00.000Z',
    },
  },
};

/**
 * Legacy message.completed event (for backwards compatibility)
 */
export const legacyMessageCompleted: MockEventData = {
  type: 'message.completed',
  properties: {
    sessionID: TEST_SESSION_ID,
    messageID: 'legacy-msg-001',
  },
};

/**
 * Tool invocation part update
 */
export const messagePartToolInvocation: MockEventData = {
  type: 'message.part.updated',
  properties: {
    sessionID: TEST_SESSION_ID,
    part: {
      type: 'tool-invocation',
      messageID: TEST_MESSAGE_ID,
      toolInvocationId: 'tool-001',
      toolName: 'read_file',
      state: 'pending',
      args: { path: '/test/file.txt' },
    },
  },
};

/**
 * Event with mismatched session ID (should be filtered)
 */
export const eventWithDifferentSession: MockEventData = {
  type: 'message.updated',
  properties: {
    sessionID: 'different-session-456',
    info: {
      id: 'msg-other-001',
      role: 'assistant',
      time: {
        created: '2026-01-03T12:00:00.000Z',
      },
    },
  },
};

/**
 * Helper to create a complete streaming sequence
 */
export function createStreamingSequence(
  sessionId: string = TEST_SESSION_ID,
  messageId: string = TEST_MESSAGE_ID,
  textChunks: string[] = ['Hello, ', 'world!']
): MockEventData[] {
  const events: MockEventData[] = [];

  // Message created/updated
  events.push({
    type: 'message.updated',
    properties: {
      sessionID: sessionId,
      info: {
        id: messageId,
        role: 'assistant',
        time: { created: new Date().toISOString() },
      },
    },
  });

  // Text deltas
  for (const chunk of textChunks) {
    events.push({
      type: 'message.part.updated',
      properties: {
        sessionID: sessionId,
        part: { type: 'text', messageID: messageId },
        delta: chunk,
      },
    });
  }

  // Session idle
  events.push({
    type: 'session.status',
    properties: {
      sessionID: sessionId,
      status: { type: 'idle' },
    },
  });

  return events;
}

/**
 * All mock events for easy iteration in tests
 */
export const allMockEvents = {
  serverConnectedEvent,
  messageUpdatedAssistant,
  messageUpdatedUser,
  messagePartUpdatedWithDelta,
  messagePartUpdatedWithDelta2,
  messagePartUpdatedFullText,
  sessionStatusIdle,
  sessionStatusRunning,
  sessionStatusBusy,
  sessionStatusPending,
  sessionIdleEvent,
  legacyMessageCreated,
  legacyMessageCompleted,
  messagePartToolInvocation,
  eventWithDifferentSession,
};
