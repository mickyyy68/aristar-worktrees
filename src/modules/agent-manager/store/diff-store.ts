/**
 * Diff Store
 *
 * Dedicated Zustand store for managing file diffs from session.diff SSE events.
 * Diffs are indexed by sessionID and then by file path for efficient lookup.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logger } from "@core/lib";
import type {
  FileDiff,
  SessionDiffEvent,
  OpenCodeSSEEvent,
} from "../api/opencode-types";

// ============ State Interface ============

interface DiffState {
  /** Diffs indexed by sessionID, then by file path */
  diffs: Record<string, Record<string, FileDiff>>;
}

// ============ Actions Interface ============

interface DiffActions {
  /** Handle a session.diff SSE event */
  handleDiffEvent(event: SessionDiffEvent): void;

  /** Get diff for a specific file in a session */
  getDiffForFile(sessionId: string, filePath: string): FileDiff | null;

  /** Get all diffs for a session */
  getSessionDiffs(sessionId: string): FileDiff[];

  /** Clear diffs for a session */
  clearSessionDiffs(sessionId: string): void;

  /** Handle any SSE event (filters for session.diff) */
  handleSSEEvent(event: OpenCodeSSEEvent): void;
}

type DiffStore = DiffState & DiffActions;

// ============ Store Implementation ============

export const useDiffStore = create<DiffStore>()(
  persist(
    (set, get) => ({
      diffs: {},

      handleDiffEvent(event) {
        const { sessionID, diff } = event.properties;

        // Skip if no diffs
        if (!diff || diff.length === 0) {
          void logger.debug(
            "[DiffStore]",
            `No diffs in event for session ${sessionID}`,
          );
          return;
        }

        set((state) => {
          const sessionDiffs = { ...(state.diffs[sessionID] || {}) };

          // Index by file path, newer diffs overwrite older ones
          for (const fileDiff of diff) {
            sessionDiffs[fileDiff.file] = fileDiff;
            void logger.debug(
              "[DiffStore]",
              `Stored diff for ${fileDiff.file} (session ${sessionID}): +${fileDiff.additions}/-${fileDiff.deletions}`,
            );
          }

          return {
            diffs: {
              ...state.diffs,
              [sessionID]: sessionDiffs,
            },
          };
        });
      },

      getDiffForFile(sessionId, filePath) {
        const sessionDiffs = get().diffs[sessionId];
        if (!sessionDiffs) return null;

        // Try exact match first
        if (sessionDiffs[filePath]) {
          return sessionDiffs[filePath];
        }

        // Try matching by path suffix to handle relative vs absolute path differences.
        // The diff event might store "project/src/utils.ts" (absolute)
        // while tool args have "src/utils.ts" (relative), or vice versa.
        // We only return if exactly one path matches to avoid ambiguity
        // (e.g., both "src/utils/index.ts" and "test/utils/index.ts" matching "utils/index.ts").
        const matchingPaths = Object.entries(sessionDiffs).filter(
          ([path]) => path.endsWith(filePath) || filePath.endsWith(path),
        );
        if (matchingPaths.length === 1) {
          return matchingPaths[0][1];
        }

        return null;
      },

      getSessionDiffs(sessionId) {
        const sessionDiffs = get().diffs[sessionId];
        return sessionDiffs ? Object.values(sessionDiffs) : [];
      },

      clearSessionDiffs(sessionId) {
        set((state) => {
          const { [sessionId]: _removed, ...remaining } = state.diffs;
          void logger.debug(
            "[DiffStore]",
            `Cleared diffs for session ${sessionId}`,
          );
          return { diffs: remaining };
        });
      },

      handleSSEEvent(event) {
        if (event.type === "session.diff") {
          get().handleDiffEvent(event as SessionDiffEvent);
        }
      },
    }),
    {
      name: "aristar-diff-store",
      partialize: (state) => ({
        diffs: state.diffs,
      }),
    },
  ),
);
