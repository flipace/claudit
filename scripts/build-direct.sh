#!/bin/bash
set -e

# Build for direct distribution (notarized DMG)
# Uses non-sandboxed entitlements for full filesystem access

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_CONF="$PROJECT_ROOT/src-tauri/tauri.conf.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[direct]${NC} $1"; }
success() { echo -e "${GREEN}[direct]${NC} $1"; }
warn() { echo -e "${YELLOW}[direct]${NC} $1"; }
error() { echo -e "${RED}[direct]${NC} $1"; exit 1; }

# Parse arguments
SKIP_NOTARIZE=false
SKIP_UPLOAD=false
NOTARY_PROFILE="notary-profile"

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-notarize) SKIP_NOTARIZE=true; shift ;;
    --skip-upload) SKIP_UPLOAD=true; shift ;;
    --notary-profile) NOTARY_PROFILE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --skip-notarize    Skip notarization step"
      echo "  --skip-upload      Skip MinIO upload"
      echo "  --notary-profile   Notarytool keychain profile (default: notary-profile)"
      exit 0
      ;;
    *) error "Unknown option: $1" ;;
  esac
done

cd "$PROJECT_ROOT"

# Check for signing identity
if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
  # Try to find Developer ID Application certificate
  APPLE_SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')
  if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
    error "No Developer ID Application certificate found. Set APPLE_SIGNING_IDENTITY env var."
  fi
fi
log "Signing identity: $APPLE_SIGNING_IDENTITY"

# Get version
VERSION=$(node -p "require('./package.json').version")
log "Building Claudit v$VERSION for direct distribution"

# Backup original entitlements setting
ORIGINAL_ENTITLEMENTS=$(grep '"entitlements"' "$TAURI_CONF" | sed 's/.*: *"\([^"]*\)".*/\1/')
log "Original entitlements: $ORIGINAL_ENTITLEMENTS"

# Switch to direct distribution entitlements
log "Switching to direct distribution entitlements..."
sed -i '' 's/"entitlements": "[^"]*"/"entitlements": "entitlements.direct.plist"/' "$TAURI_CONF"

# Cleanup function to restore entitlements
cleanup() {
  log "Restoring original entitlements..."
  sed -i '' "s/\"entitlements\": \"[^\"]*\"/\"entitlements\": \"$ORIGINAL_ENTITLEMENTS\"/" "$TAURI_CONF"
}
trap cleanup EXIT

# Build
log "Building with Developer ID signing..."
export APPLE_SIGNING_IDENTITY
pnpm tauri build

# Find the DMG
DMG_PATH=$(find "$PROJECT_ROOT/src-tauri/target/release/bundle/dmg" -name "*.dmg" -type f | head -1)
if [ -z "$DMG_PATH" ]; then
  error "No DMG found after build"
fi
success "Built: $(basename "$DMG_PATH")"

# Notarize
if [ "$SKIP_NOTARIZE" = false ]; then
  log "Notarizing..."
  "$SCRIPT_DIR/notarize.sh" submit --dmg "$DMG_PATH" --profile "$NOTARY_PROFILE" --wait

  # Staple the notarization ticket
  log "Stapling notarization ticket..."
  xcrun stapler staple "$DMG_PATH"
  success "Notarization complete!"
else
  warn "Skipping notarization (--skip-notarize)"
fi

# Upload to MinIO
if [ "$SKIP_UPLOAD" = false ]; then
  if command -v mc &> /dev/null; then
    MINIO_ALIAS="${MINIO_ALIAS:-claudit}"
    BUCKET="${MINIO_BUCKET:-claudit-releases}"
    RELEASE_TAG="v$VERSION"

    log "Uploading to MinIO..."
    mc cp "$DMG_PATH" "$MINIO_ALIAS/$BUCKET/$RELEASE_TAG/"
    success "Uploaded to $MINIO_ALIAS/$BUCKET/$RELEASE_TAG/"
  else
    warn "MinIO client (mc) not installed. Skipping upload."
  fi
else
  warn "Skipping upload (--skip-upload)"
fi

echo ""
success "Direct distribution build complete!"
success "DMG: $DMG_PATH"
