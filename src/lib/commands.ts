import { invoke } from '@tauri-apps/api/core';
import type { WorktreeMetadata, Repository, BranchInfo, CommitInfo } from '@/store/types';

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
