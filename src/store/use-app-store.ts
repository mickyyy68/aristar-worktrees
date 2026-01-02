import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Repository, AppSettings, ActiveView } from '@/store/types';
import * as commands from '@/lib/commands';
import { opencodeClient, type OpenCodeMessage } from '@/lib/opencode';

interface OpenCodeState {
  isOpencodePanelOpen: boolean;
  activeWorktreePath: string | null;
  opencodePort: number | null;
  sessionId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  messages: OpenCodeMessage[];
}

interface OpenCodeActions {
  openOpencodePanel: (worktreePath: string) => Promise<void>;
  closeOpencodePanel: () => Promise<void>;
  sendToOpencode: (prompt: string) => Promise<void>;
  clearOpencodeMessages: () => void;
  clearOpencodeError: () => void;
}

interface AppState {
  repositories: Repository[];
  settings: AppSettings;
  selectedRepositoryId: string | null;
  activeView: ActiveView;
  isLoading: boolean;
  error: string | null;
  
  opencode: OpenCodeState & OpenCodeActions;
  
  setSettings: (settings: Partial<AppSettings>) => void;
  setSelectedRepository: (id: string | null) => void;
  setActiveView: (view: ActiveView) => void;
  
  loadRepositories: () => Promise<void>;
  addRepository: (path: string) => Promise<void>;
  removeRepository: (id: string) => Promise<void>;
  refreshRepository: (id: string) => Promise<void>;
  
  createWorktree: (
    repoPath: string,
    name: string,
    branch: string | undefined,
    commit: string | undefined,
    startupScript: string | undefined,
    executeScript: boolean
  ) => Promise<void>;
  
  removeWorktree: (path: string, force: boolean, deleteBranch: boolean) => Promise<void>;
  renameWorktree: (oldPath: string, newName: string) => Promise<void>;
  lockWorktree: (path: string, reason: string | undefined) => Promise<void>;
  unlockWorktree: (path: string) => Promise<void>;
  
  openInTerminal: (path: string) => Promise<void>;
  openInEditor: (path: string) => Promise<void>;
  revealInFinder: (path: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  
  clearError: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'system',
  autoRefresh: true,
  terminalApp: 'terminal',
  editorApp: 'vscode',
};

export const useAppStore = create<AppState>()(
    persist(
      (set, get) => ({
      repositories: [],
      settings: defaultSettings,
      selectedRepositoryId: null,
      activeView: 'worktrees',
      isLoading: false,
      error: null,

      setActiveView: (view) => {
        set({ activeView: view });
      },

      setSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      setSelectedRepository: (id) => {
        set({ selectedRepositoryId: id });
      },

      loadRepositories: async () => {
        set({ isLoading: true, error: null });
        try {
          const repos = await commands.getRepositories();
          set({ repositories: repos, isLoading: false });
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      addRepository: async (path) => {
        set({ isLoading: true, error: null });
        try {
          console.log('[addRepository] Calling add_repository with path:', path);
          const repo = await commands.addRepository(path);
          console.log('[addRepository] Success:', repo);
          set((state) => ({
            repositories: [...state.repositories, repo],
            isLoading: false,
          }));
        } catch (err) {
          console.error('[addRepository] Error:', err);
          set({ error: String(err), isLoading: false });
        }
      },

      removeRepository: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await commands.removeRepository(id);
          set((state) => ({
            repositories: state.repositories.filter((r) => r.id !== id),
            selectedRepositoryId: state.selectedRepositoryId === id ? null : state.selectedRepositoryId,
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      refreshRepository: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const updatedRepo = await commands.refreshRepository(id);
          set((state) => ({
            repositories: state.repositories.map((r) =>
              r.id === id ? updatedRepo : r
            ),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      createWorktree: async (repoPath, name, branch, commit, startupScript, executeScript) => {
        set({ isLoading: true, error: null });
        try {
          const newWorktree = await commands.createWorktree(
            repoPath,
            name,
            branch,
            commit,
            startupScript,
            executeScript
          );
          set((state) => ({
            repositories: state.repositories.map((repo) =>
              repo.path === repoPath
                ? {
                    ...repo,
                    worktrees: [...repo.worktrees, newWorktree],
                  }
                : repo
            ),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      removeWorktree: async (path, force, deleteBranch) => {
        set({ isLoading: true, error: null });
        try {
          await commands.removeWorktree(path, force, deleteBranch);
          set((state) => ({
            repositories: state.repositories.map((repo) => ({
              ...repo,
              worktrees: repo.worktrees.filter((wt) => wt.path !== path),
            })),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      renameWorktree: async (oldPath, newName) => {
        set({ isLoading: true, error: null });
        try {
          const updatedWorktree = await commands.renameWorktree(oldPath, newName);
          set((state) => ({
            repositories: state.repositories.map((repo) => ({
              ...repo,
              worktrees: repo.worktrees.map((wt) =>
                wt.path === oldPath ? updatedWorktree : wt
              ),
            })),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      lockWorktree: async (path, reason) => {
        set({ isLoading: true, error: null });
        try {
          await commands.lockWorktree(path, reason);
          set((state) => ({
            repositories: state.repositories.map((repo) => ({
              ...repo,
              worktrees: repo.worktrees.map((wt) =>
                wt.path === path ? { ...wt, isLocked: true, lockReason: reason } : wt
              ),
            })),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      unlockWorktree: async (path) => {
        set({ isLoading: true, error: null });
        try {
          await commands.unlockWorktree(path);
          set((state) => ({
            repositories: state.repositories.map((repo) => ({
              ...repo,
              worktrees: repo.worktrees.map((wt) =>
                wt.path === path ? { ...wt, isLocked: false, lockReason: undefined } : wt
              ),
            })),
            isLoading: false,
          }));
        } catch (err) {
          set({ error: String(err), isLoading: false });
        }
      },

      openInTerminal: async (path) => {
        try {
          const { settings } = get();
          await commands.openInTerminal(
            path,
            settings.terminalApp,
            settings.customTerminalCommand
          );
        } catch (err) {
          set({ error: String(err) });
        }
      },

      openInEditor: async (path) => {
        try {
          const { settings } = get();
          await commands.openInEditor(
            path,
            settings.editorApp,
            settings.customEditorCommand
          );
        } catch (err) {
          set({ error: String(err) });
        }
      },

      revealInFinder: async (path) => {
        try {
          await commands.revealInFinder(path);
        } catch (err) {
          set({ error: String(err) });
        }
      },

      copyToClipboard: async (text) => {
        try {
          await commands.copyToClipboard(text);
        } catch (err) {
          set({ error: String(err) });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      opencode: {
        isOpencodePanelOpen: false,
        activeWorktreePath: null,
        opencodePort: null,
        sessionId: null,
        isConnected: false,
        isLoading: false,
        error: null,
        messages: [],

        openOpencodePanel: async (worktreePath) => {
          set((state) => ({ opencode: { ...state.opencode, isLoading: true, error: null } }));
          try {
            console.log('[opencode] Starting OpenCode for worktree:', worktreePath);
            const port = await commands.startOpencode(worktreePath);
            opencodeClient.connect(port);

            const sessions = await opencodeClient.listSessions();
            let sessionId = sessions[0]?.id || null;

            if (!sessionId) {
              const session = await opencodeClient.createSession('Aristar Worktrees');
              sessionId = session.id;
            } else {
              opencodeClient.setSession(sessionId);
            }

            const messages = await opencodeClient.getSessionMessages();

            set((state) => ({
              opencode: {
                ...state.opencode,
                isOpencodePanelOpen: true,
                activeWorktreePath: worktreePath,
                opencodePort: port,
                sessionId,
                isConnected: true,
                isLoading: false,
                messages,
                error: null,
              },
            }));
            console.log('[opencode] Connected on port', port, 'with session', sessionId);
          } catch (err) {
            console.error('[opencode] Failed to start:', err);
            set((state) => ({
              opencode: { ...state.opencode, isLoading: false, error: String(err) },
            }));
          }
        },

        closeOpencodePanel: async () => {
          const { opencode } = get();
          if (opencode.activeWorktreePath) {
            try {
              await commands.stopOpencode(opencode.activeWorktreePath);
            } catch (err) {
              console.error('[opencode] Error stopping server:', err);
            }
          }
          opencodeClient.disconnect();
          set((state) => ({
            opencode: {
              ...state.opencode,
              isOpencodePanelOpen: false,
              activeWorktreePath: null,
              opencodePort: null,
              sessionId: null,
              isConnected: false,
              messages: [],
            },
          }));
        },

        sendToOpencode: async (prompt) => {
          const { opencode } = get();
          if (!opencode.isConnected || !opencode.sessionId) {
            throw new Error('OpenCode not connected');
          }

          const userMessage: OpenCodeMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: prompt,
            timestamp: new Date(),
          };

          set((state) => ({
            opencode: {
              ...state.opencode,
              messages: [...state.opencode.messages, userMessage],
              isLoading: true,
            },
          }));

          try {
            const response = await opencodeClient.sendPrompt(prompt);

            set((state) => ({
              opencode: {
                ...state.opencode,
                messages: [...state.opencode.messages, response],
                isLoading: false,
              },
            }));
          } catch (err) {
            set((state) => ({
              opencode: {
                ...state.opencode,
                isLoading: false,
                error: String(err),
              },
            }));
            throw err;
          }
        },

        clearOpencodeMessages: () => {
          set((state) => ({
            opencode: { ...state.opencode, messages: [] },
          }));
        },

        clearOpencodeError: () => {
          set((state) => ({
            opencode: { ...state.opencode, error: null },
          }));
        },
      },
    }),
    {
      name: 'aristar-worktrees-store',
      partialize: (state) => ({
        repositories: state.repositories,
        settings: state.settings,
        selectedRepositoryId: state.selectedRepositoryId,
        activeView: state.activeView,
      }),
    }
  )
);
