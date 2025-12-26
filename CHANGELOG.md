# Changelog

All notable changes to Claudit will be documented in this file.

## [0.5.0] - 2025-12-26

### Added
- **MCP Server Editing**: Edit global MCP server configurations directly within Claudit
- **Nested Folder Commands**: Display commands from nested folders in the commands view
- **Project-Level Views**: Updated MCP servers and commands view on projects level

### Fixed
- Layout issues on agents page
- Projects commands folder now opens correctly

### Changed
- License changed to MIT

## [0.4.1] - 2025-12-23

### Added
- **Enhanced Tray Menu**: Comprehensive tray menu with new features:
  - Burn rate display ($/hr) alongside today's cost
  - Current session tokens and cost
  - Primary model indicator in header
  - Recent Projects submenu (top 5 projects, click to open)
  - Open Section submenu (navigate directly to any app section)
  - Quick Actions submenu (open config files and Claude folder)
  - Notifications toggle checkbox

### Fixed
- **Tray Menu Performance**: Menu interactions are now instant
  - Cached project list and settings to avoid disk I/O on every click
  - Background thread for disk persistence
- **Settings Sync**: Tray notifications toggle now syncs with UI and vice versa

## [0.4.0] - 2025-12-23

### Added
- **Session Browser**: Browse and view all session conversations for each project
- **In-Conversation Search**: Search within session conversations with `Cmd+F`
  - Text highlighting for matches
  - Navigate between matches with Enter/Shift+Enter or arrow buttons
  - Match counter showing current position
- **Session Export**: Export sessions to HTML format
- **Session Resume**: Copy resume command or open terminal with resume
- **Warmup Sessions**: Collapsed section for warmup/init sessions

### Changed
- **Centralized Pricing**: All model pricing now in single source of truth
- **Pricing Display**: View all model costs in Settings page
- **Project Paths**: Improved project name display using actual paths from .claude.json
- **Code Refactoring**: Extracted `ConversationViewer`, `ConversationSearch`, `MessageBubble`, and `ContentBlock` components

### Fixed
- Session cost calculation now includes cache tokens (cache_read, cache_creation)
- Project names with dashes now display correctly

## [0.3.0] - 2025-12-22

### Added
- **Projects Page**: Browse all Claude Code projects with usage stats, costs, and last used dates
- **AI Suggestions**: Get Claude-powered suggestions to improve project workflow (custom agents, commands, CLAUDE.md improvements, MCP recommendations)
- **Project Details**: View CLAUDE.md content, project-specific commands, and MCP servers for each project
- **Project Images**: Set custom images for projects
- **Agents Page**: Browse global and project-specific Claude agents with content preview
- **Plugins Page**: Browse installed Claude plugins with marketplace info
- **Config Page**: View and explore Claude configuration
- **Analysis Page**: Deep usage analysis with patterns
- **Backup Page**: Backup and export Claude configuration
- **Sidebar Navigation**: New collapsible sidebar with all app sections
- **Markdown Viewer**: Render CLAUDE.md and agent files with syntax highlighting

### Fixed
- AI suggestions now display immediately after generation (fixed race condition)

## [0.2.0] - 2025-12-22

### Added
- Close button (X) in header to minimize to tray
- Hide from dock on macOS when window is closed
- Show in dock when window is focused again

### Fixed
- App icon now displays correctly (orange C logo) in favicon and headers
- Landing page updated to show correct app icon
- Cross-platform messaging (no longer claims "native macOS only")

### Changed
- Regenerated icon.ico from correct PNG sources

## [0.1.0] - 2025-12-21

### Added
- Initial release
- Real-time token consumption monitoring in menu bar
- Cost tracking with burn rate ($/hour)
- 5-hour session block tracking
- Per-project and per-model breakdowns
- Analytics dashboard with 8 interactive charts
- Notifications when Claude finishes responding
- Hook system integration with Claude Code
