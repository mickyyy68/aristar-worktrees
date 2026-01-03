/**
 * Prompt Optimizer Hook
 *
 * Manages the prompt optimization flow:
 * - Starts a temporary OpenCode session with "build" agent
 * - Sends the optimization prompt
 * - Returns the result for user review
 * - Handles loading state and errors
 */

import { useState, useCallback } from 'react';
import { opencodeClient } from '../api/opencode';
import { commands } from '@core/lib';

export interface UsePromptOptimizerResult {
  /** Start the optimization process */
  optimize: (prompt: string, repoPath: string, model: string) => Promise<string | null>;
  /** Whether optimization is in progress */
  isOptimizing: boolean;
  /** Error message if optimization failed */
  error: string | null;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook for optimizing prompts using the OpenCode "build" agent
 *
 * @returns Methods and state for prompt optimization
 */
export function usePromptOptimizer(): UsePromptOptimizerResult {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(
    async (prompt: string, repoPath: string, model: string): Promise<string | null> => {
      if (!prompt.trim()) {
        setError('No prompt to optimize');
        return null;
      }

      setIsOptimizing(true);
      setError(null);

      try {
        // Start OpenCode server for this repository
        const port = await commands.startOpencode(repoPath);
        opencodeClient.connect(port);

        // Wait for the server to be ready
        const isReady = await opencodeClient.waitForReady();
        if (!isReady) {
          throw new Error('OpenCode server did not become ready');
        }

        // Call the optimize prompt method
        const optimizedPrompt = await opencodeClient.optimizePrompt(prompt, model);

        return optimizedPrompt;
      } catch (err) {
        console.error('[usePromptOptimizer] Optimization failed:', err);
        const errorMsg = String(err);
        setError(errorMsg);
        return null;
      } finally {
        setIsOptimizing(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    optimize,
    isOptimizing,
    error,
    clearError,
  };
}
