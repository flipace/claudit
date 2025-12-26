#!/bin/bash
set -e

# Build for Mac App Store submission
# Uses sandboxed entitlements required by App Store

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_CONF="$PROJECT_ROOT/src-tauri/tauri.conf.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[appstore]${NC} $1"; }
success() { echo -e "${GREEN}[appstore]${NC} $1"; }
warn() { echo -e "${YELLOW}[appstore]${NC} $1"; }
error() { echo -e "${RED}[appstore]${NC} $1"; exit 1; }

cd "$PROJECT_ROOT"

# Check for signing identity
if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
  # Try to find 3rd Party Mac Developer Application certificate
  APPLE_SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')
  if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
    error "No '3rd Party Mac Developer Application' certificate found. Set APPLE_SIGNING_IDENTITY env var."
  fi
fi
log "Signing identity: $APPLE_SIGNING_IDENTITY"

# Get version
VERSION=$(node -p "require('./package.json').version")
log "Building Claudit v$VERSION for App Store"

# Ensure we're using App Store entitlements
CURRENT_ENTITLEMENTS=$(grep '"entitlements"' "$TAURI_CONF" | sed 's/.*: *"\([^"]*\)".*/\1/')
if [ "$CURRENT_ENTITLEMENTS" != "entitlements.plist" ]; then
  log "Switching to App Store entitlements..."
  sed -i '' 's/"entitlements": "[^"]*"/"entitlements": "entitlements.plist"/' "$TAURI_CONF"
fi

# Build
log "Building with App Store signing..."
export APPLE_SIGNING_IDENTITY
pnpm tauri build

# Find artifacts
APP_PATH=$(find "$PROJECT_ROOT/src-tauri/target/release/bundle/macos" -name "*.app" -type d | head -1)
DMG_PATH=$(find "$PROJECT_ROOT/src-tauri/target/release/bundle/dmg" -name "*.dmg" -type f | head -1)

success "Build complete!"
echo ""
log "Artifacts:"
[ -n "$APP_PATH" ] && echo "  App: $APP_PATH"
[ -n "$DMG_PATH" ] && echo "  DMG: $DMG_PATH"
echo ""
log "Next steps for App Store submission:"
echo "  1. Open Transporter app"
echo "  2. Drag the .app bundle (not DMG) to Transporter"
echo "  3. Or use: xcrun altool --upload-app -f \"$APP_PATH\" -t macos"
echo ""
warn "Note: You may need to create a .pkg for App Store submission"
echo "  productbuild --sign \"3rd Party Mac Developer Installer: ...\" --component \"$APP_PATH\" /Applications Claudit.pkg"
