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

// Theme types
export type ThemeColorScheme = Record<string, string>;

export interface ThemeDefinition {
  name: string;
  displayName: string;
  description: string;
  light: ThemeColorScheme;
  dark: ThemeColorScheme;
}

export type ColorScheme = 'light' | 'dark' | 'system';

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

export type ToolOutputVisibility = 'hidden' | 'truncated' | 'always';

export interface ToolDisplaySettings {
  /** Whether tools are expanded by default */
  expandToolsByDefault: boolean;
  /** Whether to show full command/args alongside description */
  showToolCommands: boolean;
  /** Output visibility mode */
  outputVisibility: ToolOutputVisibility;
  /** Max lines when output is truncated */
  truncatedOutputLines: number;
}

/** Model selection for optimization (provider/model-id format) */
export interface OptimizationModelSelection {
  providerId: string;
  modelId: string;
}

export interface AppSettings {
  /** Selected theme name */
  themeName: string;
  /** Color scheme preference: light, dark, or system */
  colorScheme: ColorScheme;
  defaultBasePath?: string;
  autoRefresh: boolean;
  terminalApp: TerminalApp;
  customTerminalCommand?: string;
  editorApp: EditorApp;
  customEditorCommand?: string;
  /** Tool display settings for Agent Manager */
  toolDisplay: ToolDisplaySettings;
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** AI model to use for prompt optimization (provider/model-id format) */
  optimizationModel?: OptimizationModelSelection;
}

export interface StoreData {
  repositories: Repository[];
  settings: AppSettings;
}

export type SourceType = 'current-branch' | 'existing-branch' | 'commit';

export type ActiveView = 'worktrees' | 'agent-manager';

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

// Agent Manager types are now in @agent-manager/store/types
// Re-export for backwards compatibility during migration
export type {
  TaskStatus,
  AgentStatus,
  TaskAgent,
  Task,
  OpenCodeModel,
  OpenCodeProvider,
  OpenCodeAgentConfig,
  ModelSelection,
  CreateTaskParams,
  TextPart,
  ToolInvocationPart,
  ToolResultPart,
  MessagePart,
  MessageStatus,
  OpenCodeSSEEvent,
  MessagePartDeltaEvent,
  MessageCreatedEvent,
  MessageCompletedEvent,
  SessionUpdatedEvent,
  StreamingMessage,
} from '@agent-manager/store/types';
