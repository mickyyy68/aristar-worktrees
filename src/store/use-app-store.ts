import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Repository, AppSettings, ActiveView } from '@/store/types';
import { commands } from '@core/lib';

interface AppState {
  repositories: Repository[];
  settings: AppSettings;
  selectedRepositoryId: string | null;
  activeView: ActiveView;
  isLoading: boolean;
  error: string | null;
  
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
  themeName: 'aristar',
  colorScheme: 'system',
  autoRefresh: true,
  terminalApp: 'terminal',
  editorApp: 'vscode',
  toolDisplay: {
    expandToolsByDefault: false,
    showToolCommands: false,
    outputVisibility: 'hidden',
    truncatedOutputLines: 10,
  },
  sidebarCollapsed: false,
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
          const repo = await commands.addRepository(path);
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
