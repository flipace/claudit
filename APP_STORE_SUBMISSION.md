# App Store Submission Guide for Claudit

This guide covers how to submit Claudit to the Mac App Store.

## Prerequisites

### 1. Apple Developer Program
- Enrolled in Apple Developer Program ($99/year)
- Access to [App Store Connect](https://appstoreconnect.apple.com)
- Access to [Apple Developer Portal](https://developer.apple.com)

### 2. Certificates (from developer.apple.com)

You need TWO certificates for App Store submission:

#### a) 3rd Party Mac Developer Application
- Used to sign the `.app` bundle
- Create at: developer.apple.com → Certificates → Create → "Mac App Store"
- Download and install in Keychain

#### b) 3rd Party Mac Developer Installer  
- Used to sign the `.pkg` installer
- Create at: developer.apple.com → Certificates → Create → "Mac Installer Distribution"
- Download and install in Keychain

**Note:** These are different from "Developer ID" certificates (used for notarization of direct downloads).

### 3. App Store Connect Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new macOS app:
   - Bundle ID: `at.flipace.claudit`
   - SKU: `claudit`
   - Name: `Claudit`
3. Fill in all required metadata (description, screenshots, categories, etc.)

### 4. App-Specific Password

Generate an app-specific password for command-line uploads:
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → Security → App-Specific Passwords
3. Generate new password
4. Save it securely (you'll use it for uploads)

## Configuration

### Verify Certificate Names

List your certificates:
```bash
security find-identity -v -p codesigning
```

You should see both:
- `3rd Party Mac Developer Application: Your Name (TEAMID)`
- `3rd Party Mac Developer Installer: Your Name (TEAMID)`

## Building and Submitting

### Option 1: Full Automated Workflow

```bash
export APPLE_SIGNING_IDENTITY="3rd Party Mac Developer Application: Your Name (TEAMID)"
export APPLE_ID="your@apple.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="TEAMID"  # Optional

./scripts/.local/app-store-submit.sh submit --version 0.4.1
```

This will:
1. Build the app (arm64 only, macOS 15.0+)
2. Sign the `.app` bundle with Application certificate
3. Create `.pkg` with `productbuild` (includes required metadata)
4. Sign the `.pkg` with Installer certificate (auto-detected)
5. Upload to App Store Connect

### Option 2: Step-by-Step

```bash
# 1. Build
./scripts/.local/app-store-submit.sh build --version 0.4.1

# 2. Sign the app bundle
./scripts/.local/app-store-submit.sh sign \
  --signing-identity "3rd Party Mac Developer Application: Your Name (TEAMID)"

# 3. Create signed package
./scripts/.local/app-store-submit.sh package \
  --signing-identity "3rd Party Mac Developer Application: Your Name (TEAMID)"

# 4. Upload
./scripts/.local/app-store-submit.sh upload \
  --apple-id "your@apple.com" \
  --app-specific-password "xxxx-xxxx-xxxx-xxxx"
```

## What Changed from Direct Distribution

| Aspect | Direct Distribution | App Store |
|--------|---------------------|-----------|
| Certificate | Developer ID Application | 3rd Party Mac Developer Application |
| Installer Cert | Developer ID Installer | 3rd Party Mac Developer Installer |
| Package Tool | `pkgbuild` | `productbuild` (with Distribution.xml) |
| Architecture | Universal or arm64 | arm64 only (with macOS 15.0+ target) |
| Notarization | Required (via `notarize.sh`) | Not needed (Apple does it) |
| Sandboxing | Optional | Required |
| Distribution | DMG/PKG download | App Store only |

## Technical Details

### Architecture
- Building **arm64 only** (Apple Silicon native)
- Requires **macOS 15.0+** (set in `tauri.conf.json`)
- Apple accepts arm64-only if deployment target is 12.0+ (we use 15.0)

### Package Structure
The script creates a proper product archive using `productbuild` with:
- `Distribution.xml` with required metadata (product-identifier, product-version)
- Component package signed with Application certificate
- Product archive signed with Installer certificate
- Meets all App Store requirements

### Entitlements
The app uses these entitlements (see `entitlements.plist`):
- `com.apple.security.app-sandbox` - Required for App Store
- `com.apple.security.network.client` - HTTP server for hooks
- `com.apple.security.network.server` - HTTP server for hooks
- `com.apple.security.files.user-selected.read-write` - File access
- `com.apple.security.files.downloads.read-write` - Downloads access
- `com.apple.security.automation.apple-events` - AppleScript automation

## After Upload

1. **Wait for processing** (10-30 minutes)
   - Check email for notifications
   - Monitor in App Store Connect → App → TestFlight

2. **Check for issues**
   - If validation fails, check email for details
   - Common issues:
     - Missing entitlements
     - Unsigned frameworks/dylibs
     - Invalid bundle structure

3. **Submit for review**
   - Once processed successfully
   - Fill in "What's New" and review information
   - Submit for App Review

4. **App Review** (1-3 days typically)
   - Apple reviews your app
   - May request changes or clarifications

5. **Release**
   - After approval, you can release immediately or schedule

## Troubleshooting

### "Unsupported toolchain" error
- Make sure you're using `productbuild`, not `pkgbuild` alone
- The script now uses `productbuild` with proper Distribution.xml

### "Invalid bundle" (architecture) error
- macOS deployment target must be 12.0+ for arm64-only (now set to 15.0)
- Already set in `tauri.conf.json`

### "Package signature invalid" error
- Use "3rd Party Mac Developer Installer" certificate
- The script auto-detects this based on your Application certificate

### "Invalid product archive metadata" errors
- `productbuild` with Distribution.xml provides required metadata
- The script now includes product-identifier and product-version

### "Minimum system version mismatch" error
- Distribution.xml must match LSMinimumSystemVersion (currently 15.0)
- The script handles this automatically

### "Failed to get main Info.plist" error
- This happens when using `--root` instead of `--component` with `pkgbuild`
- The script now correctly uses `--component` for app bundles
- This preserves the Info.plist metadata that Apple requires

### "App sandbox not enabled" error
- ALL executables in the app must be signed with the sandbox entitlement
- Not just the main app bundle - every binary needs entitlements
- The script now signs all Mach-O binaries with entitlements:
  - Main executable: `claudit`
  - All dylibs and frameworks
  - Any helper binaries
- To verify: `codesign -d --entitlements - YourApp.app` should show sandbox=true

## Security Notes

- Never commit certificates or passwords to git
- Use environment variables for sensitive data
- App-specific passwords can be regenerated anytime
- Certificates expire after 1 year (renew on developer.apple.com)

## Resources

- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Portal](https://developer.apple.com)
- [Mac App Store Submission Guide](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [Xcode App Distribution Guide](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)

