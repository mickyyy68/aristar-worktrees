import { invoke } from '@tauri-apps/api/core';
import type {
  WorktreeMetadata,
  Repository,
  BranchInfo,
  CommitInfo,
  Task,
  TaskStatus,
  AgentStatus,
  ModelSelection,
} from '@/store/types';

export async function getRepositories(): Promise<Repository[]> {
  return await invoke('get_repositories');
}

export async function addRepository(path: string): Promise<Repository> {
  return await invoke('add_repository', { path });
}

export async function removeRepository(id: string): Promise<void> {
  return await invoke('remove_repository', { id });
}

export async function refreshRepository(id: string): Promise<Repository> {
  return await invoke('refresh_repository', { id });
}

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  return await invoke('get_branches', { repoPath });
}

export async function getCommits(repoPath: string, limit?: number): Promise<CommitInfo[]> {
  return await invoke('get_commits', { repoPath, limit });
}

export async function listWorktrees(repoPath: string): Promise<WorktreeMetadata[]> {
  return await invoke('list_worktrees', { repoPath });
}

export async function createWorktree(
  repoPath: string,
  name: string,
  branch: string | undefined,
  commit: string | undefined,
  startupScript: string | undefined,
  executeScript: boolean
): Promise<WorktreeMetadata> {
  return await invoke('create_worktree', {
    repoPath,
    name,
    branch,
    commit,
    startupScript,
    executeScript,
  });
}

export async function removeWorktree(path: string, force: boolean, deleteBranch: boolean): Promise<void> {
  return await invoke('remove_worktree', { path, force, deleteBranch });
}

export async function renameWorktree(oldPath: string, newName: string): Promise<WorktreeMetadata> {
  return await invoke('rename_worktree', { oldPath, newName });
}

export async function lockWorktree(path: string, reason: string | undefined): Promise<void> {
  return await invoke('lock_worktree', { path, reason });
}

export async function unlockWorktree(path: string): Promise<void> {
  return await invoke('unlock_worktree', { path });
}

export async function openInTerminal(
  path: string,
  app: string,
  customCommand?: string
): Promise<void> {
  return await invoke('open_in_terminal', { path, app, customCommand });
}

export async function openInEditor(
  path: string,
  app: string,
  customCommand?: string
): Promise<void> {
  return await invoke('open_in_editor', { path, app, customCommand });
}

export async function revealInFinder(path: string): Promise<void> {
  return await invoke('reveal_in_finder', { path });
}

export async function copyToClipboard(text: string): Promise<void> {
  return await invoke('copy_to_clipboard', { text });
}

export async function startOpencode(worktreePath: string): Promise<number> {
  return await invoke('start_opencode', { worktreePath });
}

export async function stopOpencode(worktreePath: string): Promise<void> {
  return await invoke('stop_opencode', { worktreePath });
}

export async function getOpencodeStatus(worktreePath: string): Promise<number | null> {
  return await invoke('get_opencode_status', { worktreePath });
}

export async function isOpencodeRunning(worktreePath: string): Promise<boolean> {
  return await invoke('is_opencode_running', { worktreePath });
}

// ============ Task Manager Commands ============

export async function createTask(
  name: string,
  sourceType: string,
  sourceBranch: string | undefined,
  sourceCommit: string | undefined,
  sourceRepoPath: string,
  agentType: string,
  models: ModelSelection[]
): Promise<Task> {
  return await invoke('create_task', {
    name,
    sourceType,
    sourceBranch,
    sourceCommit,
    sourceRepoPath,
    agentType,
    models,
  });
}

export async function getTasks(): Promise<Task[]> {
  return await invoke('get_tasks');
}

export async function getTask(taskId: string): Promise<Task> {
  return await invoke('get_task', { taskId });
}

export async function updateTask(
  taskId: string,
  name: string | undefined,
  status: TaskStatus | undefined
): Promise<Task> {
  return await invoke('update_task', { taskId, name, status });
}

export async function deleteTask(taskId: string, deleteWorktrees: boolean): Promise<void> {
  return await invoke('delete_task', { taskId, deleteWorktrees });
}

// ============ Agent Management Commands ============

export async function addAgentToTask(
  taskId: string,
  modelId: string,
  providerId: string,
  agentType: string | undefined
): Promise<Task> {
  return await invoke('add_agent_to_task', { taskId, modelId, providerId, agentType });
}

export async function removeAgentFromTask(
  taskId: string,
  agentId: string,
  deleteWorktree: boolean
): Promise<void> {
  return await invoke('remove_agent_from_task', { taskId, agentId, deleteWorktree });
}

export async function updateAgentSession(
  taskId: string,
  agentId: string,
  sessionId: string | null
): Promise<void> {
  return await invoke('update_agent_session', { taskId, agentId, sessionId });
}

export async function updateAgentStatus(
  taskId: string,
  agentId: string,
  status: AgentStatus
): Promise<void> {
  return await invoke('update_agent_status', { taskId, agentId, status });
}

export async function acceptAgent(taskId: string, agentId: string): Promise<void> {
  return await invoke('accept_agent', { taskId, agentId });
}

export async function cleanupUnacceptedAgents(taskId: string): Promise<void> {
  return await invoke('cleanup_unaccepted_agents', { taskId });
}

// ============ Agent OpenCode Commands ============

export async function startAgentOpencode(taskId: string, agentId: string): Promise<number> {
  return await invoke('start_agent_opencode', { taskId, agentId });
}

export async function stopAgentOpencode(taskId: string, agentId: string): Promise<void> {
  return await invoke('stop_agent_opencode', { taskId, agentId });
}

export async function getAgentOpencodePort(
  taskId: string,
  agentId: string
): Promise<number | null> {
  return await invoke('get_agent_opencode_port', { taskId, agentId });
}

export async function stopTaskAllOpencode(taskId: string): Promise<void> {
  return await invoke('stop_task_all_opencode', { taskId });
}
