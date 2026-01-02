# Aristar Worktrees

A beautiful Tauri application for managing git worktrees with a modern UI.

## Features

- **Multiple Repository Support**: Add and manage worktrees across multiple git repositories
- **Create Worktrees**: Create new worktrees from current branch, existing branches, or specific commits
- **Startup Scripts**: Define and execute startup scripts when creating worktrees
- **Navigate Easily**: Open worktrees in terminal, editor, or reveal in Finder with one click
- **Rename Worktrees**: Safely rename worktrees with proper git metadata updates
- **Lock Worktrees**: Prevent accidental pruning with optional lock reasons
- **Dark/Light Theme**: Beautiful theming with system preference detection
- **Persistent State**: Your repositories and settings are automatically saved

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS v4
- **Backend**: Rust + Tauri 2.0
- **State Management**: Zustand + Tauri Store plugin

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.77+
- Git
- macOS (Terminal.app for terminal integration)

### Installation

```bash
# Install dependencies
npm install

# Install Rust dependencies
cd src-tauri
cargo install cargo-tauri
cd ..

# Run in development mode
npm run dev

# Build for production
npm run tauri build
```

## Usage

1. **Add a Repository**: Click "Add Repository" and select a git repository
2. **Create a Worktree**: Click "New Worktree" and configure:
   - Worktree name
   - Source (current branch, existing branch, or commit)
   - Optional startup script
3. **Navigate**: Click "Terminal" to open in terminal, or use the menu for other options
4. **Manage**: Use the menu on each card to rename, lock, or delete worktrees

## Theme

The application uses your system's color scheme by default. You can manually override this using the theme toggle in the header.

## License

MIT
