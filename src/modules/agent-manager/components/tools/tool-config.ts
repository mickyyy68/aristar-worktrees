import {
  Terminal,
  Pencil,
  FilePlus,
  FileText,
  Search,
  FolderSearch,
  List,
  Code2,
  FileDiff,
  BookOpen,
  ListChecks,
  ClipboardList,
  Globe,
  GitBranch,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type ToolCategory = 'execution' | 'file-ops' | 'search' | 'analysis' | 'ai' | 'tasks' | 'network' | 'unknown';

export interface ToolConfig {
  icon: LucideIcon;
  colorClass: string;
  category: ToolCategory;
  label: string;
}

/**
 * Configuration for OpenCode built-in tools
 * Based on https://opencode.ai/docs/tools/
 */
export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  // Execution
  bash: {
    icon: Terminal,
    colorClass: 'text-green-500',
    category: 'execution',
    label: 'Terminal',
  },

  // File operations
  edit: {
    icon: Pencil,
    colorClass: 'text-blue-500',
    category: 'file-ops',
    label: 'Edit',
  },
  write: {
    icon: FilePlus,
    colorClass: 'text-blue-400',
    category: 'file-ops',
    label: 'Write',
  },
  read: {
    icon: FileText,
    colorClass: 'text-slate-500',
    category: 'file-ops',
    label: 'Read',
  },
  list: {
    icon: List,
    colorClass: 'text-slate-400',
    category: 'file-ops',
    label: 'List',
  },
  patch: {
    icon: FileDiff,
    colorClass: 'text-yellow-500',
    category: 'file-ops',
    label: 'Patch',
  },

  // Search
  grep: {
    icon: Search,
    colorClass: 'text-purple-500',
    category: 'search',
    label: 'Search',
  },
  glob: {
    icon: FolderSearch,
    colorClass: 'text-purple-400',
    category: 'search',
    label: 'Find Files',
  },

  // Analysis
  lsp: {
    icon: Code2,
    colorClass: 'text-orange-500',
    category: 'analysis',
    label: 'LSP',
  },

  // AI/Agents
  skill: {
    icon: BookOpen,
    colorClass: 'text-cyan-500',
    category: 'ai',
    label: 'Skill',
  },
  task: {
    icon: GitBranch,
    colorClass: 'text-amber-500',
    category: 'ai',
    label: 'Subagent',
  },

  // Tasks/Todo
  todowrite: {
    icon: ListChecks,
    colorClass: 'text-teal-500',
    category: 'tasks',
    label: 'Todo',
  },
  todoread: {
    icon: ClipboardList,
    colorClass: 'text-teal-400',
    category: 'tasks',
    label: 'Read Todo',
  },

  // Network
  webfetch: {
    icon: Globe,
    colorClass: 'text-indigo-500',
    category: 'network',
    label: 'Web Fetch',
  },
};

/**
 * Default config for unknown tools (MCP, custom, etc.)
 */
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  icon: Wrench,
  colorClass: 'text-muted-foreground',
  category: 'unknown',
  label: 'Tool',
};

/**
 * Get tool configuration by name
 * Falls back to default config for unknown tools
 */
export function getToolConfig(toolName: string): ToolConfig {
  // Normalize tool name (lowercase, remove prefixes like mcp_)
  const normalizedName = toolName.toLowerCase();
  
  return TOOL_CONFIGS[normalizedName] || DEFAULT_TOOL_CONFIG;
}

/**
 * Get a display label for the tool
 * Uses the configured label or falls back to the tool name
 */
export function getToolLabel(toolName: string): string {
  const config = getToolConfig(toolName);
  if (config === DEFAULT_TOOL_CONFIG) {
    // For unknown tools, format the name nicely
    return toolName
      .replace(/^mcp_/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return config.label;
}
