# Research: SST OpenCode Integration for Aristar Worktrees

**Date:** January 2, 2026
**Author:** OpenCode AI Assistant
**Status:** Research Complete

---

## Executive Summary

This document researches the integration of SST OpenCode (opencode.ai) into the Aristar Worktrees Tauri application. The goal is to allow users to invoke OpenCode directly from the app's UI instead of using the terminal.

**Recommendation:** Use OpenCode's HTTP Server mode with a Tauri-managed child process lifecycle. This provides full programmatic access, session persistence, and real-time streaming capabilities.

---

## Table of Contents

1. [What is SST OpenCode?](#what-is-sst-opencode)
2. [Comparison of OpenCode Variants](#comparison-of-opencode-variants)
3. [Integration Options](#integration-options)
4. [Recommended Architecture](#recommended-architecture)
5. [Implementation Plan](#implementation-plan)
6. [Security Considerations](#security-considerations)
7. [References](#references)

---

## What is SST OpenCode?

**SST OpenCode** (github.com/sst/opencode) is an open-source AI coding agent developed by the team behind Serverless Stack (SST). It offers a powerful terminal-based interface for AI-assisted coding tasks.

### Key Statistics

| Metric | Value |
|--------|-------|
| GitHub Stars | 45.6k |
| Forks | 3.9k |
| Contributors | 487+ |
| Active Releases | 647+ |
| Latest Version | v1.0.223 (Jan 1, 2026) |

### Core Features

- **Multi-Model Support**: Works with 75+ models from providers like OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, and local models via OpenAI-compatible APIs
- **Provider-Agnostic**: Not coupled to any single LLM provider
- **Built-in Agents**:
  - `build` - Default agent with full development access
  - `plan` - Read-only agent for analysis and code exploration
  - `general` - Subagent for complex multi-step tasks
- **LSP Integration**: Automatic Language Server Protocol support for code intelligence
- **MCP Support**: Model Context Protocol for extensibility
- **Session Management**: Persistent conversations across sessions
- **Client/Server Architecture**: HTTP server with REST API for programmatic access

### Installation Methods

```bash
# YOLO (curl)
curl -fsSL https://opencode.ai/install | bash

# npm
npm install -g opencode-ai

# Homebrew
brew install opencode

# Docker
docker run -it --rm ghcr.io/sst/opencode
```

---

## Comparison of OpenCode Variants

There are two distinct projects with similar names in the AI coding agent space:

### 1. SST OpenCode (Active - Recommended)

| Attribute | Details |
|-----------|---------|
| Repository | github.com/sst/opencode |
| Status | Actively maintained |
| Stars | 45.6k |
| Language | TypeScript (primary) |
| Architecture | Client/Server (HTTP API) |
| License | MIT |
| Desktop App | Available (Beta) |

**Key Differentiators:**
- 100% open source
- Provider-agnostic (supports multiple LLM providers)
- Strong TUI focus (built by neovim users)
- Client/server architecture enabling remote control
- Active development with frequent releases

### 2. OpenCode by opencode-ai (Archived)

| Attribute | Details |
|-----------|---------|
| Repository | github.com/opencode-ai/opencode |
| Status | Archived (Sep 2025) |
| Stars | 9.6k |
| Language | Go |
| Architecture | CLI with TUI |
| License | MIT |
| Successor | Crush (by CharmBracelet) |

**Note:** This project is no longer maintained. It was succeeded by Crush (github.com/charmbracelet/crush), which has 16.6k stars and is actively developed.

### 3. Crush (Alternative to OpenCode)

| Attribute | Details |
|-----------|---------|
| Repository | github.com/charmbracelet/crush |
| Status | Actively maintained |
| Stars | 16.6k |
| Language | Go |
| Architecture | CLI with TUI |
| License | FSL-1.1-MIT |

**Recommendation:** Use **SST OpenCode** for this project due to:
- Active development
- HTTP server API (perfect for integration)
- TypeScript SDK available
- Better documentation
- Larger community

---

## Integration Options

### Option 1: Sidecar Binary (CLI)

Bundle OpenCode as a sidecar binary and execute via shell commands.

**Approach:**
```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/opencode"]
  }
}
```

**Usage:**
```typescript
import { Command } from '@tauri-apps/plugin-shell';

const command = Command.sidecar('binaries/opencode', ['run', 'Explain this code']);
const output = await command.execute();
```

**Pros:**
- Simple to implement
- No external dependencies

**Cons:**
- ❌ Stateless - each invocation is a new process (loses context)
- ❌ No streaming support
- ❌ Poor UX for conversations
- ❌ Cannot resume sessions
- ❌ High latency per request (process startup)

**Verdict:** ❌ **Not recommended** for this use case.

---

### Option 2: HTTP Server Mode (Recommended)

Run `opencode serve` as a child process and communicate via REST API.

**Approach:**
```bash
# Start server
opencode serve --port 4096 --hostname 127.0.0.1

# Communicate via REST API
curl -X POST http://127.0.0.1:4096/session/default/message \
  -H "Content-Type: application/json" \
  -d '{"parts": [{"type": "text", "text": "Explain this code"}]}'
```

**Pros:**
- ✅ Full programmatic access via REST API
- ✅ Session persistence across requests
- ✅ Real-time streaming via SSE
- ✅ Official TypeScript SDK available
- ✅ Proper context management
- ✅ Supports multiple concurrent sessions

**Cons:**
- Requires managing child process lifecycle
- Slightly more complex implementation
- Need to handle port allocation

**Verdict:** ✅ **Recommended** for this use case.

---

### Option 3: Direct Library Integration

Call OpenCode's code directly as a library.

**Approach:** Import OpenCode's TypeScript modules directly.

**Pros:**
- Tightest integration
- Direct function calls

**Cons:**
- ❌ OpenCode is not published as a library
- ❌ Would require bundling entire codebase
- ❌ No official support for this

**Verdict:** ❌ **Not possible** with current architecture.

---

## Recommended Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Aristar Worktrees                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  React Frontend                          │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │   │
│  │  │ WorktreeCard│  │ OpenCode    │  │ OpenCode        │ │   │
│  │  │             │──│ Panel       │──│ SDK Client      │ │   │
│  │  └─────────────┘  └─────────────┘  └────────┬────────┘ │   │
│  │                                              │          │   │
│  └──────────────────────────────────────────────┼──────────┘   │
│                                                 │               │
│                    Tauri Commands               │               │
│                         │                       │               │
│  ┌──────────────────────┴───────────────────────┴──────────┐   │
│  │                   Rust Backend                           │   │
│  │                                                         │   │
│  │  ┌─────────────────┐    ┌────────────────────────────┐ │   │
│  │  │ AppState        │    │ OpenCodeManager            │ │   │
│  │  │ - repositories  │    │ - process: Option<Child>   │ │   │
│  │  │ - worktrees     │    │ - port: u16                │ │   │
│  │  │ - settings      │    │ - working_dir: PathBuf     │ │   │
│  │  └─────────────────┘    │ - sessions: HashMap        │ │   │
│  │                         └─────────────┬──────────────┘ │   │
│  └───────────────────────────────────────┼─────────────────┘   │
│                                          │                      │
└──────────────────────────────────────────┼──────────────────────┘
                                           │
                              ┌────────────┴────────────┐
                              │    opencode serve       │
                              │    (child process)      │
                              │                         │
                              │  Port: dynamic          │
                              │  Host: 127.0.0.1        │
                              │  CWD: worktree path     │
                              └─────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Server per worktree** | Proper Git context isolation - each worktree has independent context |
| **Lazy start** | Only spawn OpenCode when user explicitly opens the panel |
| **Local binding** | Always use `127.0.0.1` for security, never `0.0.0.0` |
| **Tauri commands for lifecycle** | Only for start/stop/status; frontend communicates directly via HTTP |
| **Single OpenCode instance per worktree** | Reuse sessions, proper cleanup |

---

## Implementation Plan

### Phase 1: Rust Backend Infrastructure (2-3 days)

#### Dependencies

Add to `src-tauri/Cargo.toml`:

```toml
[dependencies]
portpicker = "1.5"  # For dynamic port allocation
```

#### OpenCode Manager

Create `src-tauri/src/commands/opencode_manager.rs`:

```rust
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::collections::HashMap;
use std::path::PathBuf;
use portpicker::pick_unused_port;

pub struct OpenCodeInstance {
    process: Child,
    port: u16,
    working_dir: PathBuf,
}

#[derive(Default)]
pub struct OpenCodeManager {
    instances: Mutex<HashMap<PathBuf, OpenCodeInstance>>,
}

impl OpenCodeManager {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }

    pub fn start(&self, worktree_path: PathBuf) -> Result<u16, String> {
        let mut instances = self.instances.lock().map_err(|e| e.to_string())?;

        // Return existing instance if running
        if let Some(instance) = instances.get(&worktree_path) {
            return Ok(instance.port);
        }

        // Find available port
        let port = pick_unused_port()
            .ok_or("No available port")?;

        // Start opencode serve
        let child = Command::new("opencode")
            .args(["serve", "--port", &port.to_string(), "--hostname", "127.0.0.1"])
            .current_dir(&worktree_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start OpenCode: {}", e))?;

        instances.insert(worktree_path, OpenCodeInstance {
            process: child,
            port,
            working_dir: worktree_path,
        });

        Ok(port)
    }

    pub fn stop(&self, worktree_path: &PathBuf) -> Result<(), String> {
        let mut instances = self.instances.lock().map_err(|e| e.to_string())?;
        if let Some(mut instance) = instances.remove(worktree_path) {
            instance.process.kill().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn stop_all(&self) {
        if let Ok(mut instances) = self.instances.lock() {
            for (_, mut instance) in instances.drain() {
                let _ = instance.process.kill();
            }
        }
    }

    pub fn get_port(&self, worktree_path: &PathBuf) -> Result<Option<u16>, String> {
        let instances = self.instances.lock().map_err(|e| e.to_string())?;
        Ok(instances.get(worktree_path).map(|i| i.port))
    }
}
```

#### Tauri Commands

Create `src-tauri/src/commands/opencode.rs`:

```rust
use crate::commands::opencode_manager::OpenCodeManager;
use tauri::State;
use std::path::PathBuf;

#[tauri::command]
pub fn start_opencode(
    state: State<OpenCodeManager>,
    worktree_path: String,
) -> Result<u16, String> {
    let path = PathBuf::from(worktree_path);
    state.start(path)
}

#[tauri::command]
pub fn stop_opencode(
    state: State<OpenCodeManager>,
    worktree_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(worktree_path);
    state.stop(&path)
}

#[tauri::command]
pub fn get_opencode_status(
    state: State<OpenCodeManager>,
    worktree_path: String,
) -> Result<Option<u16>, String> {
    let path = PathBuf::from(worktree_path);
    state.get_port(&path)
}
```

#### Register in main.rs

```rust
mod commands;
mod commands_opencode;

use commands_opencode::OpenCodeManager;

fn main() {
    tauri::Builder::default()
        .manage(OpenCodeManager::new())
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            commands::start_opencode,
            commands::stop_opencode,
            commands::get_opencode_status,
        ])
        .on_window_event(|event| {
            if let tauri::WindowEvent::Destroyed = event.event() {
                if let Some(manager) = event.window().try_state::<OpenCodeManager>() {
                    manager.stop_all();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### Phase 2: Frontend Integration (2-3 days)

#### Install SDK

```bash
bun add @opencode-ai/sdk
```

#### OpenCode Client

Create `src/lib/opencode.ts`:

```typescript
import { createOpencodeClient } from '@opencode-ai/sdk';

export class OpenCodeClient {
  private client: ReturnType<typeof createOpencodeClient> | null = null;
  private baseUrl: string | null = null;

  connect(port: number) {
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.client = createOpencodeClient({ baseUrl: this.baseUrl });
  }

  disconnect() {
    this.client = null;
    this.baseUrl = null;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async createSession(title?: string) {
    if (!this.client) throw new Error('Not connected');
    const result = await this.client.session.create({ body: { title } });
    return result.data;
  }

  async sendPrompt(sessionId: string, prompt: string) {
    if (!this.client) throw new Error('Not connected');
    const result = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: prompt }],
      },
    });
    return result.data;
  }

  async *streamEvents() {
    if (!this.client) throw new Error('Not connected');
    const events = await this.client.event.subscribe();
    for await (const event of events.stream) {
      yield event;
    }
  }

  async listSessions() {
    if (!this.client) throw new Error('Not connected');
    const result = await this.client.session.get({});
    return result.data;
  }

  async getSession(sessionId: string) {
    if (!this.client) throw new Error('Not connected');
    const result = await this.client.session.get({ path: { id: sessionId } });
    return result.data;
  }
}

export const opencodeClient = new OpenCodeClient();
```

#### Zustand Store Integration

Add to `src/store/use-app-store.ts`:

```typescript
interface OpenCodeState {
  activeWorktreePath: string | null;
  opencodePort: number | null;
  sessionId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface OpenCodeActions {
  startOpenCode: (worktreePath: string) => Promise<void>;
  stopOpenCode: () => Promise<void>;
  sendToOpenCode: (prompt: string) => Promise<void>;
  createSession: (title?: string) => Promise<void>;
  clearError: () => void;
}

interface AppState {
  // ... existing fields
  opencode: OpenCodeState & OpenCodeActions;
}

// Actions implementation
const startOpenCode = async (worktreePath: string) => {
  const port = await commands.startOpencode(worktreePath);
  opencodeClient.connect(port);
  set((state) => {
    state.opencode.opencodePort = port;
    state.opencode.activeWorktreePath = worktreePath;
    state.opencode.isConnected = true;
  });
};

const stopOpenCode = async () => {
  if (get().opencode.activeWorktreePath) {
    await commands.stopOpencode(get().opencode.activeWorktreePath);
  }
  opencodeClient.disconnect();
  set((state) => {
    state.opencode.activeWorktreePath = null;
    state.opencode.opencodePort = null;
    state.opencode.sessionId = null;
    state.opencode.isConnected = false;
  });
};
```

---

### Phase 3: UI Components (3-4 days)

#### OpenCodePanel Component

Create `src/components/opencode-panel.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { opencodeClient } from '@/lib/opencode';
import { useAppStore } from '@/store/use-app-store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function OpenCodePanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { opencode } = useAppStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // TODO: Implement streaming response
      const response = await opencodeClient.sendPrompt(
        opencode.sessionId!,
        input
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n'),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('OpenCode error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p>Start a conversation with OpenCode</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary/10 ml-auto max-w-[80%]'
                    : 'bg-muted mr-auto max-w-[80%]'
                }`}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            ))}
            {isLoading && (
              <div className="text-muted-foreground text-sm">
                OpenCode is thinking...
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask OpenCode something..."
            disabled={!opencode.isConnected || isLoading}
          />
          <Button type="submit" disabled={!opencode.isConnected || isLoading}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

### Phase 4: Polish (1-2 days)

- Add loading states and error handling
- Session persistence UI (list/resume sessions)
- Settings for default model selection
- Keyboard shortcuts

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Local-only binding** | Always use `127.0.0.1`, never `0.0.0.0` |
| **Port exposure** | Use dynamic port allocation, don't hardcode |
| **API key handling** | OpenCode manages its own auth in `~/.local/share/opencode/auth.json` |
| **Process cleanup** | Implement app close handler to kill child processes |
| **CORS** | Not needed - same-origin from Tauri webview |
| **Authentication state** | User must configure OpenCode separately |

### Cleanup Handler

```rust
// In main.rs - ensure cleanup on app close
fn main() {
    tauri::Builder::default()
        .manage(OpenCodeManager::new())
        .on_window_event(|event| {
            if let tauri::WindowEvent::Destroyed = event.event() {
                if let Some(manager) = event.window().try_state::<OpenCodeManager>() {
                    manager.stop_all();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Key Considerations

### Performance

| Aspect | Recommendation |
|--------|----------------|
| **Startup** | Lazy start - only spawn OpenCode when user explicitly opens it |
| **Session reuse** | Don't kill server between interactions |
| **Memory** | Each OpenCode instance uses ~50-100MB; limit concurrent instances |

### UX Decisions

| Decision | Recommendation |
|----------|----------------|
| **One server per worktree vs. global** | Per-worktree for proper Git context isolation |
| **Embed chat vs. external window** | Embedded panel for seamless experience |
| **Auto-start server on app launch** | No - lazy start is better for resource usage |

### Risks

| Risk | Mitigation |
|------|------------|
| **OpenCode version compatibility** | Pin SDK version, test updates |
| **Server startup time** | Show loading state (2-3 seconds cold start) |
| **Memory usage** | Limit concurrent instances, stop unused servers |
| **Authentication** | Detect and prompt if not authenticated |

---

## Alternative: Single Server with Directory Switching

If memory is a concern, consider this alternative architecture:

```typescript
// Single server, switch context via working directory
await client.tui.executeCommand({
  body: { command: `/cd ${worktreePath}` }
});
```

**Pros:**
- Lower memory footprint (one process instead of many)

**Cons:**
- Sessions span worktrees (confusing for users)
- No true Git context isolation

**Recommendation:** Start with per-worktree approach and optimize later if needed.

---

## References

### Official Documentation

1. **OpenCode Home** - opencode.ai
2. **OpenCode Docs** - opencode.ai/docs
3. **CLI Reference** - opencode.ai/docs/cli
4. **Server API** - opencode.ai/docs/server
5. **GitHub Repository** - github.com/sst/opencode

### Tauri Documentation

1. **Sidecar Binaries** - v2.tauri.app/develop/sidecar
2. **Shell Plugin** - v2.tauri.app/plugin/shell
3. **Process Management** - v2.tauri.app/plugin/process

### Alternative Projects

1. **Crush (CharmBracelet)** - github.com/charmbracelet/crush
2. **xterm.js** - xtermjs.org
3. **Tauri Terminal Demo** - github.com/marc2332/tauri-terminal

---

## Appendix: OpenCode Server API Reference

### Global Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/global/health` | Server health and version | `{ healthy: true, version: string }` |
| GET | `/global/event` | Global events (SSE) | Event stream |

### Session Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/session` | List all sessions |
| POST | `/session` | Create a new session |
| GET | `/session/:id` | Get session details |
| DELETE | `/session/:id` | Delete a session |
| POST | `/session/:id/message` | Send a message |
| POST | `/session/:id/prompt_async` | Send async message |
| POST | `/session/:id/command` | Execute slash command |
| POST | `/session/:id/shell` | Run shell command |

### File Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/file/content?path=<path>` | Read file |
| GET | `/find?pattern=<pat>` | Search files |
| GET | `/find/file?query=<q>` | Find files by name |

### TUI Control Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tui/submit-prompt` | Submit prompt |
| POST | `/tui/append-prompt` | Append to prompt |
| POST | `/tui/clear-prompt` | Clear prompt |
| GET | `/tui/control/next` | Wait for control request |

---

## Conclusion

SST OpenCode is an excellent candidate for integration into Aristar Worktrees. Its client/server architecture, combined with a comprehensive REST API, makes it ideal for embedding in a Tauri application.

The recommended implementation uses HTTP Server mode with Tauri-managed child process lifecycle, providing:
- Full programmatic control via REST APIs
- Session persistence across invocations
- Real-time streaming via SSE
- Proper Git context isolation per worktree

This architecture aligns well with the existing codebase patterns and provides a seamless user experience.

---

**Document Version:** 1.0
**Last Updated:** January 2, 2026
