# Claudit - Claude Code Usage Monitor

A native macOS menu bar application that provides real-time usage analytics for Claude Code.

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
│           │   ├── analytics/   # Charts, stats display
│           │   ├── settings/    # Preferences UI
│           │   └── shared/      # Shared components
│           └── lib/        # Utilities
├── src-tauri/              # Rust backend
│   └── src/
│       ├── services/       # Core services
│       │   ├── usage.rs    # JSONL parsing
│       │   ├── analytics.rs # Stats calculation
│       │   ├── hooks.rs    # HTTP server for hooks
│       │   └── settings.rs # Preferences
│       ├── tray.rs         # System tray menu
│       └── lib.rs          # Main entry
└── landing/                # Landing page (optional)
```

## Architecture

### Data Flow
1. Claude Code writes usage data to `~/.claude/projects/**/*.jsonl`
2. UsageReader parses JSONL files and deduplicates entries
3. AnalyticsService calculates stats, costs, burn rates
4. Tray menu displays live stats, updates every 30s
5. Analytics window shows interactive charts

### Hook System
- HTTP server runs on localhost:3456
- Receives events from Claude Code hooks (Stop, SubagentStop, PostToolUse)
- Triggers notifications when Claude finishes responding

### Token Pricing (per 1M tokens)
- claude-sonnet-4: $3 input, $15 output
- claude-opus-4: $15 input, $75 output
- Other models: $3 input, $15 output (default)

## Features

- Real-time token consumption in menu bar
- Cost tracking with burn rate ($/hour)
- 5-hour session block tracking
- Per-project and per-model breakdowns
- Analytics dashboard with 8 interactive charts
- Notifications when Claude finishes responding

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

## Style Guide

- Dark theme by default
- Use `cn()` for conditional classnames
- Keep components simple and composable
- Glassy/frosted look: `bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50`
