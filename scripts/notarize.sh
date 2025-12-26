#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configure these via environment variables or set defaults
DEFAULT_ALIAS="${MINIO_ALIAS:-claudit}"
DEFAULT_BUCKET="${MINIO_BUCKET:-claudit-releases}"

usage() {
  cat <<'USAGE'
Claudit notarization helper

Usage:
  scripts/notarize.sh <command> [options]

Commands:
  build    Build the app (delegates to scripts/local-release.sh --skip-upload)
  submit   Submit a DMG for notarization (optionally --wait)
  wait     Wait for a request id to finish
  log      Fetch notarization log for a request id
  staple   Staple the ticket onto the DMG
  upload   Upload the DMG to MinIO
  publish  Build, upload pending, notarize (wait), staple, upload final

Options:
  --dmg <path>            Path to DMG (defaults to latest in src-tauri/target)
  --profile <name>        Keychain profile for notarytool
  --request-id <id>       Notarization request id (for wait/log)
  --timeout <seconds>     Timeout for wait (default: 600)
  --wait                  Wait for submit to finish
  --universal             Build universal macOS binaries (build/publish)
  --skip-build            Skip build step (publish)

  --alias <name>          MinIO alias (default: claudit)
  --bucket <name>         MinIO bucket (default: claudit-releases)
  --tag <tag>             Release tag (default: v<package.json version>)
  --prefix <path>         Upload prefix inside bucket (overrides --pending/--final)
  --pending               Upload under <tag>/pending/
  --final                 Upload under <tag>/

Examples:
  scripts/notarize.sh build
  scripts/notarize.sh submit --profile my-notary --wait
  scripts/notarize.sh upload --pending
  scripts/notarize.sh wait --profile my-notary --request-id <id>
  scripts/notarize.sh staple --dmg path/to/Claudit.dmg
  scripts/notarize.sh upload --final
  scripts/notarize.sh publish --profile my-notary
USAGE
}

die() {
  echo "Error: $*" >&2
  exit 1
}

get_version() {
  node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "0.0.0"
}

find_latest_dmg() {
  shopt -s nullglob globstar
  local files=("$PROJECT_ROOT"/src-tauri/target/**/bundle/dmg/*.dmg)
  shopt -u nullglob globstar
  if [ ${#files[@]} -eq 0 ]; then
    return 1
  fi
  ls -t "${files[@]}" | head -1
}

resolve_dmg() {
  if [ -n "${DMG:-}" ]; then
    echo "$DMG"
    return 0
  fi
  local latest
  if ! latest="$(find_latest_dmg)"; then
    die "No DMG found under src-tauri/target/**/bundle/dmg"
  fi
  echo "$latest"
}

ensure_mc() {
  if ! command -v mc >/dev/null 2>&1; then
    die "MinIO client (mc) not installed. Install with: brew install minio/stable/mc"
  fi
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

COMMAND="$1"
shift

DMG=""
PROFILE=""
REQUEST_ID=""
TIMEOUT="600"
WAIT="false"
UNIVERSAL="false"
SKIP_BUILD="false"
ALIAS="$DEFAULT_ALIAS"
BUCKET="$DEFAULT_BUCKET"
TAG=""
PREFIX=""
PENDING="false"
FINAL="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --dmg) DMG="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --request-id) REQUEST_ID="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --wait) WAIT="true"; shift ;;
    --universal) UNIVERSAL="true"; shift ;;
    --skip-build) SKIP_BUILD="true"; shift ;;
    --alias) ALIAS="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --pending) PENDING="true"; shift ;;
    --final) FINAL="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

case "$COMMAND" in
  submit)
    [ -n "$PROFILE" ] || die "--profile is required for submit"
    DMG_PATH="$(resolve_dmg)"
    if [ "$WAIT" = "true" ]; then
      xcrun notarytool submit "$DMG_PATH" --keychain-profile "$PROFILE" --wait --timeout "$TIMEOUT"
    else
      xcrun notarytool submit "$DMG_PATH" --keychain-profile "$PROFILE"
    fi
    ;;
  wait)
    [ -n "$PROFILE" ] || die "--profile is required for wait"
    [ -n "$REQUEST_ID" ] || die "--request-id is required for wait"
    xcrun notarytool wait "$REQUEST_ID" --keychain-profile "$PROFILE" --timeout "$TIMEOUT"
    ;;
  log)
    [ -n "$PROFILE" ] || die "--profile is required for log"
    [ -n "$REQUEST_ID" ] || die "--request-id is required for log"
    xcrun notarytool log "$REQUEST_ID" --keychain-profile "$PROFILE"
    ;;
  staple)
    DMG_PATH="$(resolve_dmg)"
    xcrun stapler staple "$DMG_PATH"
    ;;
  upload)
    ensure_mc
    DMG_PATH="$(resolve_dmg)"
    if [ -z "$TAG" ]; then
      TAG="v$(get_version)"
    fi
    if [ -n "$PREFIX" ]; then
      TARGET_PREFIX="$PREFIX"
    elif [ "$PENDING" = "true" ]; then
      TARGET_PREFIX="${TAG}/pending"
    elif [ "$FINAL" = "true" ]; then
      TARGET_PREFIX="${TAG}"
    else
      TARGET_PREFIX="${TAG}"
    fi
    mc cp "$DMG_PATH" "$ALIAS/$BUCKET/$TARGET_PREFIX/"
    ;;
  build)
    if [ "$UNIVERSAL" = "true" ]; then
      "$PROJECT_ROOT/scripts/local-release.sh" --skip-upload --universal
    else
      "$PROJECT_ROOT/scripts/local-release.sh" --skip-upload
    fi
    ;;
  publish)
    [ -n "$PROFILE" ] || die "--profile is required for publish"
    if [ "$SKIP_BUILD" = "false" ]; then
      if [ "$UNIVERSAL" = "true" ]; then
        "$PROJECT_ROOT/scripts/local-release.sh" --skip-upload --universal
      else
        "$PROJECT_ROOT/scripts/local-release.sh" --skip-upload
      fi
    fi
    ensure_mc
    DMG_PATH="$(resolve_dmg)"
    if [ -z "$TAG" ]; then
      TAG="v$(get_version)"
    fi
    mc cp "$DMG_PATH" "$ALIAS/$BUCKET/$TAG/pending/"
    xcrun notarytool submit "$DMG_PATH" --keychain-profile "$PROFILE" --wait --timeout "$TIMEOUT"
    xcrun stapler staple "$DMG_PATH"
    mc cp "$DMG_PATH" "$ALIAS/$BUCKET/$TAG/"
    ;;
  *)
    usage
    exit 1
    ;;
esac
