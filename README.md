# Claude Template - Tauri

A Tauri 2 desktop app template with React frontend, system tray support, and MinIO-based release distribution. Designed for fast project setup with Claude Code.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Tauri 2 (Rust + Webview) |
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS 3 |
| Data Fetching | TanStack Query |
| Animations | Framer Motion |
| Icons | Lucide React |
| Distribution | GitHub Actions + MinIO |

## Features

- **System Tray**: App runs in background, accessible from menu bar
- **Frameless Window**: Custom titlebar with drag support
- **Auto-Updates**: Built-in Tauri updater support
- **Landing Page**: Static site with dynamic download links from MinIO
- **Cross-Platform**: Builds for macOS (Apple Silicon) and Windows

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Project Structure

```
├── src-tauri/              # Rust backend
│   ├── src/lib.rs          # Commands and setup
│   ├── src/tray.rs         # System tray menu
│   └── tauri.conf.json     # App configuration
├── packages/frontend/      # React frontend
│   ├── src/App.tsx         # Main component
│   └── src/lib/tauri.ts    # Tauri detection helper
├── landing/                # Static landing page
│   ├── index.html          # Home page
│   └── download.html       # Downloads (from MinIO)
└── .github/workflows/
    └── release.yml         # Build & upload to MinIO
```

## Adding Tauri Commands

1. Define in `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
fn my_command(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

2. Register in invoke handler:
```rust
.invoke_handler(tauri::generate_handler![greet, my_command])
```

3. Call from React:
```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<string>("my_command", { name: "World" });
```

## Customizing for Your App

1. **App Identity**: Update `src-tauri/tauri.conf.json`:
   - `productName`: Your app name
   - `identifier`: Reverse domain (e.g., `com.example.myapp`)
   - `windows[0].title`: Window title

2. **Icons**: Replace icons in `src-tauri/icons/`
   - Use `cargo tauri icon path/to/icon.png` to generate all sizes

3. **System Tray**: Customize menu in `src-tauri/src/tray.rs`

4. **Landing Page**: Update `landing/index.html` and `landing/download.html`

## Release Process

1. Bump version in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. Tag and push:
```bash
git tag v0.1.0
git push origin main --tags
```

3. GitHub Actions:
   - Builds for macOS and Windows
   - Uploads to MinIO
   - Creates `latest.json` for download page

## MinIO Setup

1. Create bucket (e.g., `app-releases`)
2. Set public read policy
3. Add GitHub secrets:
   - `MINIO_ACCESS_KEY`
   - `MINIO_SECRET_KEY`
4. Update workflow with your MinIO endpoint

## Landing Page Deployment

The `landing/` directory contains a static site deployable to any host:

```bash
# Build Docker image
cd landing
docker build -t myapp-landing .

# Or deploy to Coolify/nginx directly
```

---

Built for fast prototyping with Claude Code.
