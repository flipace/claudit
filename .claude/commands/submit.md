---
description: Build, sign, and submit app to Mac App Store
category: workflow
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

# App Store Submit Command for Claudit

Build, sign, and submit the app to Mac App Store Connect.

## Prerequisites

- Apple Distribution certificate installed: `Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)`
- 3rd Party Mac Developer Installer certificate installed
- Apple ID and app-specific password for upload (optional, can use Transporter)

## Arguments

- `$ARGUMENTS` - Optional flags:
  - `--skip-build` - Skip build step, use existing app bundle
  - `--upload` - Also upload to App Store Connect (requires APPLE_ID and APPLE_PASSWORD env vars)

## Steps

### 1. Clean old artifacts

Remove any existing unsigned or old pkg files:
```bash
rm -f Claudit.pkg Claudit-*.pkg
```

Check if old app bundle exists with root permissions and needs removal:
```bash
ls -la src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Claudit.app 2>/dev/null
```

If owned by root, ask user to run:
```bash
sudo rm -rf src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Claudit.app
```

### 2. Get current version

```bash
node -p "require('./package.json').version"
```

### 3. Build for App Store

Run the build command (unless --skip-build specified):
```bash
APPLE_SIGNING_IDENTITY="Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)" \
  ./scripts/.local/app-store-submit.sh build --version <VERSION>
```

### 4. Sign app bundle

```bash
APPLE_SIGNING_IDENTITY="Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)" \
  ./scripts/.local/app-store-submit.sh sign --version <VERSION>
```

### 5. Create and sign package

```bash
APPLE_SIGNING_IDENTITY="Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)" \
  ./scripts/.local/app-store-submit.sh package --version <VERSION>
```

### 6. Verify signatures

Verify app bundle signature:
```bash
codesign -dvv src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Claudit.app 2>&1 | grep -E "Authority|Identifier|TeamIdentifier"
```

Verify package signature:
```bash
pkgutil --check-signature Claudit-<VERSION>.pkg | head -15
```

### 7. Report results

Show the user:
- Package location: `Claudit-<VERSION>.pkg` (in project root)
- Signing status for both app bundle and package
- Instructions for upload via Transporter or command line

### 8. Upload (optional)

If `--upload` flag was passed and credentials are available:
```bash
xcrun altool --upload-app --type macos \
  --file Claudit-<VERSION>.pkg \
  --username "$APPLE_ID" \
  --password "$APPLE_PASSWORD"
```

Otherwise, remind user to use Transporter app to upload.

## Example Usage

```
/submit                    # Full build and sign, manual upload
/submit --skip-build       # Use existing build, just re-sign and package
/submit --upload           # Full workflow including upload (needs env vars)
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `APPLE_SIGNING_IDENTITY` | Code signing identity (default: Apple Distribution cert) |
| `APPLE_ID` | Apple ID email for upload |
| `APPLE_PASSWORD` | App-specific password for upload |

## Output

- Signed app bundle: `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Claudit.app`
- Signed package: `Claudit-<VERSION>.pkg` (project root)

## Troubleshooting

### Permission denied on old app bundle
Run: `sudo rm -rf src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Claudit.app`

### Invalid signature error from App Store
Ensure both certificates are used:
- App bundle: `Apple Distribution` certificate
- Package: `3rd Party Mac Developer Installer` certificate

### Upload fails
- Use app-specific password, not regular Apple ID password
- Generate at https://appleid.apple.com > Sign-In and Security > App-Specific Passwords
