# Changelog

All notable changes to Claudit will be documented in this file.

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
