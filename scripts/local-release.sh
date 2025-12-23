#!/bin/bash
set -e

# Claudit Local Release Script
# Builds the app for current platform and optionally uploads to MinIO

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[claudit]${NC} $1"; }
success() { echo -e "${GREEN}[claudit]${NC} $1"; }
warn() { echo -e "${YELLOW}[claudit]${NC} $1"; }
error() { echo -e "${RED}[claudit]${NC} $1"; exit 1; }

# Parse arguments
SKIP_UPLOAD=false
UNIVERSAL=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-upload) SKIP_UPLOAD=true; shift ;;
    --universal) UNIVERSAL=true; shift ;;
    *) error "Unknown option: $1" ;;
  esac
done

cd "$PROJECT_ROOT"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
if [ -z "$VERSION" ]; then
  error "Could not determine version from package.json"
fi
log "Building Claudit v$VERSION"

# Detect platform
case "$(uname -s)" in
  Darwin*) PLATFORM="macos" ;;
  Linux*)  PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *) error "Unsupported platform: $(uname -s)" ;;
esac
log "Platform: $PLATFORM"

# Install dependencies
log "Installing dependencies..."
pnpm install

# Build based on platform
if [ "$PLATFORM" = "macos" ]; then
  if [ "$UNIVERSAL" = true ]; then
    log "Building universal macOS binary..."
    rustup target add x86_64-apple-darwin aarch64-apple-darwin 2>/dev/null || true
    pnpm tauri build --target x86_64-apple-darwin
    pnpm tauri build --target aarch64-apple-darwin
  else
    log "Building macOS binary for current architecture..."
    pnpm tauri build
  fi
elif [ "$PLATFORM" = "linux" ]; then
  log "Building Linux binary..."
  pnpm tauri build
elif [ "$PLATFORM" = "windows" ]; then
  log "Building Windows binary..."
  pnpm tauri build
fi

success "Build complete!"

# Find artifacts
log "Locating build artifacts..."
ARTIFACTS=()
if [ "$PLATFORM" = "macos" ]; then
  for f in src-tauri/target/*/release/bundle/dmg/*.dmg \
           src-tauri/target/release/bundle/dmg/*.dmg \
           src-tauri/target/*/release/bundle/macos/*.app.tar.gz \
           src-tauri/target/release/bundle/macos/*.app.tar.gz; do
    [ -f "$f" ] && ARTIFACTS+=("$f")
  done
elif [ "$PLATFORM" = "linux" ]; then
  for f in src-tauri/target/release/bundle/appimage/*.AppImage \
           src-tauri/target/release/bundle/deb/*.deb; do
    [ -f "$f" ] && ARTIFACTS+=("$f")
  done
elif [ "$PLATFORM" = "windows" ]; then
  for f in src-tauri/target/release/bundle/msi/*.msi \
           src-tauri/target/release/bundle/nsis/*.exe; do
    [ -f "$f" ] && ARTIFACTS+=("$f")
  done
fi

if [ ${#ARTIFACTS[@]} -eq 0 ]; then
  error "No build artifacts found!"
fi

log "Found ${#ARTIFACTS[@]} artifact(s):"
for f in "${ARTIFACTS[@]}"; do
  echo "  - $(basename "$f")"
done

# Upload to MinIO
if [ "$SKIP_UPLOAD" = false ]; then
  if ! command -v mc &> /dev/null; then
    warn "MinIO client (mc) not installed. Skipping upload."
    warn "Install with: brew install minio/stable/mc"
  else
    MINIO_ALIAS="${MINIO_ALIAS:-claudit}"
    BUCKET="${MINIO_BUCKET:-claudit-releases}"
    RELEASE_TAG="v$VERSION"
    
    log "Uploading to MinIO..."
    for f in "${ARTIFACTS[@]}"; do
      log "Uploading $(basename "$f")..."
      mc cp "$f" "$MINIO_ALIAS/$BUCKET/$RELEASE_TAG/"
    done
    success "Upload complete!"
    echo ""
    if [ -n "${MINIO_ENDPOINT:-}" ]; then
      log "Release available at: ${MINIO_ENDPOINT}/$BUCKET/$RELEASE_TAG/"
    else
      log "Release uploaded to: $MINIO_ALIAS/$BUCKET/$RELEASE_TAG/"
    fi
  fi
else
  warn "Skipping upload (--skip-upload)"
fi

echo ""
success "Release v$VERSION ready!"
