# Claudit - Claude Code Usage Monitor

A native desktop application that provides real-time usage analytics for Claude Code. Available for macOS, Windows, and Linux.

## Tech Stack

- **Framework**: Tauri 2 (Rust backend + webview)
- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS 3
- **Charts**: Recharts
- **Data Fetching**: TanStack Query
- **Animations**: Motion (import from "motion/react")
- **Icons**: Lucide React

## Commands

```bash
pnpm install        # Install dependencies
pnpm dev           # Run in development mode
pnpm build         # Build for production
```

## Project Structure

```
claudit/
├── packages/
│   └── frontend/           # React frontend
│       └── src/
│           ├── domains/    # Feature-based organization
│           │   ├── analytics/   # Dashboard with charts & stats
│           │   ├── settings/    # App preferences UI
│           │   ├── projects/    # Project browser & AI suggestions
│           │   ├── agents/      # Claude agents browser
│           │   ├── plugins/     # Claude plugins browser
│           │   ├── config/      # Claude config viewer
│           │   ├── analysis/    # Deep usage analysis
│           │   ├── backup/      # Backup management
│           │   └── shared/      # Shared components
│           ├── components/      # Reusable UI components
│           └── lib/             # Utilities
├── src-tauri/              # Rust backend
│   └── src/
│       ├── services/       # Core services
│       │   ├── usage.rs    # JSONL parsing
│       │   ├── analytics.rs # Stats calculation
│       │   ├── hooks.rs    # HTTP server for hooks
│       │   ├── settings.rs # Preferences
│       │   └── config.rs   # Claude config & project management
│       ├── tray.rs         # System tray menu
│       └── lib.rs          # Main entry
└── landing/                # Landing page
```

## Architecture

### Data Flow
1. Claude Code writes usage data to `~/.claude/projects/**/*.jsonl`
2. UsageReader parses JSONL files and deduplicates entries
3. AnalyticsService calculates stats, costs, burn rates
4. Tray menu displays live stats, updates every 30s
5. Analytics window shows interactive charts

### Hook System

Claudit runs an HTTP server on localhost:3456 that receives events from Claude Code hooks.

**Supported Events:**

| Event | Trigger | Purpose |
|-------|---------|---------|
| `Stop` | Claude finishes main response | Triggers notification |
| `SubagentStop` | Subagent finishes | Triggers notification |
| `PostToolUse` | After tool execution | Granular tracking (Bash only) |

**API Endpoints:**

```bash
# Health check
curl http://localhost:3456/
# Response: {"status":"ok"}

# Send hook event
curl -X POST http://localhost:3456/hook \
  -H "Content-Type: application/json" \
  -d '{"event": "Stop"}'
# Response: {"success":true}
```

**Payload Schema:**

```typescript
interface HookEvent {
  event: "Stop" | "SubagentStop" | "PostToolUse" | "PreToolUse" | "UserPromptSubmit";
  tool?: string;      // Tool name (for PostToolUse)
  context?: string;   // Optional context
  timestamp?: string; // ISO timestamp
}
```

**Claude Code Settings Hook Config:**

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:3456/hook -H \"Content-Type: application/json\" -d '{\"event\": \"Stop\"}' > /dev/null 2>&1 &"
      }]
    }],
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:3456/hook -H \"Content-Type: application/json\" -d '{\"event\": \"SubagentStop\"}' > /dev/null 2>&1 &"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:3456/hook -H \"Content-Type: application/json\" -d \"{\"event\": \"PostToolUse\", \"tool\": \"$CLAUDE_TOOL_NAME\"}\" > /dev/null 2>&1 &"
      }]
    }]
  }
}
```

**Port Fallback:** If port 3456 is busy, the server tries ports 3457-3466.

### Token Pricing (per 1M tokens)
- claude-sonnet-4: $3 input, $15 output
- claude-opus-4: $15 input, $75 output
- Other models: $3 input, $15 output (default)

## Features

### Core Analytics
- Real-time token consumption in menu bar
- Cost tracking with burn rate ($/hour)
- 5-hour session block tracking
- Per-project and per-model breakdowns
- Analytics dashboard with interactive charts
- Notifications when Claude finishes responding

### Project Management
- Browse all Claude Code projects with usage stats
- View CLAUDE.md content with markdown rendering
- Browse project-specific commands and MCP servers
- **AI Suggestions**: Get Claude-powered suggestions to improve project workflow
- Set custom project images
- One-click open in Finder or editor

### Configuration Browser
- View and explore Claude config (~/.claude.json)
- Browse installed agents (global and project-specific)
- Browse installed plugins with marketplace info
- Deep analysis of usage patterns

### Backup & Export
- Backup Claude configuration and history
- Export usage data for analysis

## Key Patterns

### Adding a Tauri command

1. Add the command in `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
fn my_command(arg: String) -> Result<String, String> {
    Ok(format!("Hello {}", arg))
}
```

2. Register it in the invoke handler:
```rust
.invoke_handler(tauri::generate_handler![greet, my_command])
```

3. Call from frontend:
```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<string>("my_command", { arg: "world" });
```

### Window dragging (frameless window)

The header is set up for window dragging in Tauri. The `headerRef` and mouse handlers in `App.tsx` enable:
- Click and drag to move window
- Double-click to toggle maximize
- Buttons/inputs are excluded from drag behavior

### System tray

The tray is configured in `src-tauri/src/tray.rs`:
- Live stats display (tokens, costs, burn rate)
- Click "Analytics" or Cmd+A to open dashboard
- App minimizes to tray when closed (doesn't quit)

## JSONL Entry Format

Each line in the JSONL files has this structure:
```json
{
  "type": "assistant",
  "timestamp": "2024-01-01T12:00:00Z",
  "sessionId": "session-id",
  "message": {
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "usage": {
      "input_tokens": 1000,
      "output_tokens": 500,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 200
    }
  },
  "uuid": "unique-id"
}
```

### Project Folder Encoding

Claude Code stores JSONL files in `~/.claude/projects/{encoded-path}/`. The encoding:
- `/` is replaced with `-`
- Literal `-` in paths are NOT escaped (encoding is lossy/ambiguous)

Examples:
- `/Users/foo/project` → `-Users-foo-project`
- `/Users/foo-bar/project` → `-Users-foo-bar-project` (ambiguous with `/Users/foo/bar/project`)

When matching project folders to paths from `~/.claude.json`, use `encode_path_to_folder()`:
```rust
fn encode_path_to_folder(path: &str) -> String {
    path.replace('/', "-")
}
```

## Style Guide

- Dark theme by default
- Use `cn()` for conditional classnames
- Keep components simple and composable
- Glassy/frosted look: `bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50`

## Release Checklist

**IMPORTANT: Always update ALL changelogs when releasing a new version!**

1. Update version in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. Update changelogs:
   - `CHANGELOG.md` (project root)
   - `landing/changelog.html` (landing page - add new release section)

3. Commit with message: `Release vX.Y.Z`

4. Create and push git tag: `git tag vX.Y.Z && git push origin vX.Y.Z`

## Claude Code Allowed Tools

Add these to your `~/.claude/settings.json` for faster Tauri development:

```json
{
  "permissions": {
    "allow": [
      "Bash(cargo build:*)",
      "Bash(cargo run:*)",
      "Bash(cargo check:*)",
      "Bash(cargo clean:*)",
      "Bash(pnpm tauri dev:*)",
      "Bash(pnpm tauri build:*)",
      "Bash(pnpm --filter frontend tsc:*)"
    ]
  }
}
```
