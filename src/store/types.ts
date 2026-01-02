export interface WorktreeMetadata {
  id: string;
  repositoryId: string;
  name: string;
  path: string;
  branch?: string;
  commit?: string;
  isMain: boolean;
  isLocked: boolean;
  lockReason?: string;
  startupScript?: string;
  scriptExecuted: boolean;
  createdAt: number;
}

export interface Repository {
  id: string;
  path: string;
  name: string;
  worktrees: WorktreeMetadata[];
  lastScanned: number;
}

export interface CreateWorktreeRequest {
  repositoryId: string;
  name: string;
  branch?: string;
  commit?: string;
  startupScript?: string;
  executeScriptOnCreate: boolean;
}

export type TerminalApp = 'terminal' | 'ghostty' | 'alacritty' | 'kitty' | 'iterm' | 'warp' | 'custom';
export type EditorApp = 'vscode' | 'cursor' | 'zed' | 'antigravity' | 'custom';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultBasePath?: string;
  autoRefresh: boolean;
  terminalApp: TerminalApp;
  customTerminalCommand?: string;
  editorApp: EditorApp;
  customEditorCommand?: string;
}

export interface StoreData {
  repositories: Repository[];
  settings: AppSettings;
}

export type SourceType = 'current-branch' | 'existing-branch' | 'commit';

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: number;
}
