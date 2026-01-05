# Worktrees Module

> **TL;DR**: Git worktree management UI including worktree cards, repository sidebar, and dialogs for creating/renaming/deleting worktrees.

## Overview

The `worktrees` module provides the frontend UI for managing Git worktrees:

- **WorktreeCard**: Display individual worktrees with actions (terminal, editor, AI)
- **RepositorySidebar**: Repository list and selection
- **CreateWorktreeDialog**: Create new worktrees from branches or commits
- **RenameDialog**: Rename existing worktrees
- **Branch Colors**: Visual color-coding system for branches

## File Structure

```
worktrees/
├── components/
│   ├── worktree-card.tsx       # Worktree display card
│   ├── repository-sidebar.tsx   # Repository list sidebar
│   ├── create-worktree-dialog.tsx # New worktree dialog
│   ├── rename-dialog.tsx        # Rename worktree dialog
│   └── index.ts                 # Component exports
├── lib/
│   ├── branch-colors.ts         # Branch color system
│   └── index.ts                 # Lib exports
├── index.ts                     # Public exports
└── README.md                    # This file
```

## Usage

### Importing from Worktrees

```typescript
// Components
import { WorktreeCard, RepositorySidebar } from '@worktrees/components';
import { CreateWorktreeDialog, RenameDialog } from '@worktrees/components';

// Library utilities
import { getBranchColorIndex, getBranchColorStyle } from '@worktrees/lib';

// Or import from module root
import { WorktreeCard, getBranchColorIndex } from '@worktrees';
```

## Components

### `WorktreeCard`

Displays a single worktree with actions and metadata.

```typescript
import { WorktreeCard } from '@worktrees/components';

<WorktreeCard
  worktree={worktree}
  onRename={(wt) => setRenameTarget(wt)}
  onDelete={(wt) => setDeleteTarget(wt)}
  onLock={(wt) => lockWorktree(wt.path)}
  onUnlock={(wt) => unlockWorktree(wt.path)}
/>
```

**Features:**
- Branch-colored icon based on branch name pattern
- Quick action buttons: Terminal, Editor, AI, Reveal in Finder
- Dropdown menu with additional actions
- Lock/unlock status indicator
- Startup script pending indicator

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `worktree` | `WorktreeMetadata` | Worktree data from store |
| `onRename` | `(wt) => void` | Called when rename is requested |
| `onDelete` | `(wt) => void` | Called when delete is requested |
| `onLock` | `(wt) => void` | Called when lock is requested |
| `onUnlock` | `(wt) => void` | Called when unlock is requested |

### `RepositorySidebar`

Sidebar showing all repositories with selection state. The sidebar can be collapsed/expanded using the toggle button.

```typescript
import { RepositorySidebar } from '@worktrees/components';

<RepositorySidebar
  onSelectRepository={(id) => setSelectedRepository(id)}
  onRemoveRepository={(id) => removeRepository(id)}
/>
```

**Features:**
- List of added repositories
- Repository selection (stored in global state)
- Add/remove repository actions
- Repository name and path display
- Collapsible sidebar (state stored in app settings)
- Collapsed mode shows only icons with tooltips

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `onSelectRepository` | `(id) => void` | Called when a repository is selected |
| `onRemoveRepository` | `(id) => void` | Called when repository removal is requested |

### `CreateWorktreeDialog`

Dialog for creating new worktrees.

```typescript
import { CreateWorktreeDialog } from '@worktrees/components';

<CreateWorktreeDialog
  open={createOpen}
  onOpenChange={setCreateOpen}
  repoPath={selectedRepo.path}
/>
```

**Features:**
- Create from existing branch or specific commit
- Custom worktree name
- Optional startup script
- Execute script on creation option

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Dialog open state |
| `onOpenChange` | `(open) => void` | Open state change handler |
| `repoPath` | `string` | Repository path for worktree creation |

### `RenameDialog`

Dialog for renaming worktrees.

```typescript
import { RenameDialog } from '@worktrees/components';

<RenameDialog
  open={renameOpen}
  onOpenChange={setRenameOpen}
  worktree={selectedWorktree}
/>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Dialog open state |
| `onOpenChange` | `(open) => void` | Open state change handler |
| `worktree` | `WorktreeMetadata \| null` | Worktree to rename |

## Branch Color System

Branches are color-coded for visual organization using the design system's chart colors.

### Color Mapping

| Pattern | Color Index | CSS Variable |
|---------|-------------|--------------|
| `main`, `master` | 0 | `--chart-1` |
| `develop`, `development` | 1 | `--chart-2` |
| `feature/*` | 2 | `--chart-3` |
| `fix/*`, `bugfix/*`, `hotfix/*` | 3 | `--chart-4` |
| `release/*` | 4 | `--chart-5` |
| Other branches | Hash-based (0-4) | Varies |
| Detached HEAD (commit) | null | `--muted` |

### Usage

```typescript
import { getBranchColorIndex, getBranchColorStyle } from '@worktrees/lib';

// Get color index for a branch
const colorIndex = getBranchColorIndex('feature/new-ui'); // Returns 2

// Get inline styles for coloring
const styles = getBranchColorStyle(colorIndex, isMainWorktree);

// Apply to elements
<div style={styles.iconBg}>
  <GitBranch style={styles.iconText} />
</div>

<span style={{ ...styles.badgeBg, ...styles.badgeText }}>
  Branch Name
</span>
```

### `BranchColorStyle` Interface

```typescript
interface BranchColorStyle {
  iconBg: React.CSSProperties;    // Background for icon container
  iconText: React.CSSProperties;  // Text/icon color
  badgeBg: React.CSSProperties;   // Background for badge
  badgeText: React.CSSProperties; // Text color for badge
}
```

### `isProtectedBranch()`

Check if a branch is protected (main/master/develop).

```typescript
import { isProtectedBranch } from '@worktrees/lib';

if (isProtectedBranch(branchName)) {
  // Show warning before deletion
}
```

## Types

Types are imported from the shared store:

```typescript
import type { WorktreeMetadata, Repository, BranchInfo } from '@/store/types';
```

### `WorktreeMetadata`

```typescript
interface WorktreeMetadata {
  id: string;
  name: string;
  path: string;
  branch: string | null;
  commit: string | null;
  isMain: boolean;
  isLocked: boolean;
  lockReason: string | null;
  startupScript: string | null;
  scriptExecuted: boolean;
  createdAt: number;
}
```

### `Repository`

```typescript
interface Repository {
  id: string;
  path: string;
  name: string;
  worktrees: WorktreeMetadata[];
  lastScanned: number;
}
```

## Integration with Store

Components use the shared Zustand store for state and actions:

```typescript
import { useAppStore } from '@/store/use-app-store';

function MyComponent() {
  const {
    repositories,
    selectedRepositoryId,
    setSelectedRepository,
    createWorktree,
    removeWorktree,
    openInTerminal,
    openInEditor,
  } = useAppStore();
  
  // ...
}
```

## Quick Actions

Each `WorktreeCard` provides quick actions that call store methods:

| Action | Method | Description |
|--------|--------|-------------|
| Terminal | `openInTerminal(path)` | Opens worktree in configured terminal |
| Editor | `openInEditor(path)` | Opens worktree in configured editor |
| Reveal | `revealInFinder(path)` | Shows worktree in Finder |
| Copy | `copyToClipboard(path)` | Copies path to clipboard |

## External App Integration

Terminal and editor apps are configured in settings and stored in the shared store. Supported apps:

**Terminals:** Terminal.app, iTerm2, Ghostty, Alacritty, Kitty, Warp, Custom

**Editors:** VS Code, Cursor, Zed, Antigravity, Custom
