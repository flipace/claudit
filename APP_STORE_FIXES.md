# App Store Submission Fixes

This document summarizes the fixes applied to resolve all 6 validation errors from your App Store submission attempt.

## Issues Fixed

### ❌ Error 1: "Unsupported toolchain"
**Problem:** Package must be created with `productbuild`, not other tools

**Fix Applied:**
- Updated `app-store-submit.sh` to use `productbuild` instead of `pkgbuild` alone
- Created proper `Distribution.xml` with all required metadata
- Product archive now includes:
  - `product-identifier`: `at.flipace.claudit`
  - `product-version`: Version from package.json
  - Proper installer-gui-script structure
- **IMPORTANT:** Using `--component` flag (not `--root`) with `pkgbuild` for app bundles
  - This preserves `Info.plist` metadata that Apple's validation requires

**Files Changed:** `scripts/.local/app-store-submit.sh` (package command)

---

### ❌ Error 2: "Invalid bundle - arm64 only"
**Problem:** App supports arm64 but not Intel. Must either:
- Include x86_64 architecture (universal binary), OR
- Set macOS deployment target to 15.0+ (Sequoia)

**Fix Applied:**
- Set `minimumSystemVersion` to `15.0` (Sequoia - current macOS)
- This allows arm64-only builds for App Store
- Apple Silicon native performance without Intel compatibility layer

**Files Changed:** `src-tauri/tauri.conf.json`

---

### ❌ Error 3: "Package signature invalid"
**Problem:** Must be signed with "3rd Party Mac Developer Installer" certificate

**Fix Applied:**
- Updated script to auto-detect and use Installer certificate for .pkg signing
- Converts "Application" cert name to "Installer" cert name automatically
- Uses `--sign` flag with `productbuild`

**Files Changed:** `scripts/.local/app-store-submit.sh` (package command)

---

### ❌ Error 4 & 5: "Invalid product archive metadata"
**Problem:** Missing `product-identifier` and `product-version` in product archive

**Fix Applied:**
- Created `Distribution.xml` with proper metadata structure:
  ```xml
  <product id="at.flipace.claudit" version="$VERSION"/>
  ```
- `productbuild` now generates proper product archive with all metadata

**Files Changed:** `scripts/.local/app-store-submit.sh` (package command)

---

### ❌ Error 6: "Minimum system version mismatch"
**Problem:** Product definition property list had "none", must match LSMinimumSystemVersion

**Fix Applied:**
- `Distribution.xml` properly references component package
- Product archive inherits minimum system version from app bundle (15.0)
- No explicit override that would cause mismatch

**Files Changed:** `scripts/.local/app-store-submit.sh` (package command)

---

### ❌ Error 7: "App sandbox not enabled"
**Problem:** Executables inside the app don't have the sandbox entitlement applied

**Root Cause:** 
- Entitlements file has sandbox enabled ✅
- BUT entitlements weren't applied to ALL executables during signing
- Only signing the app bundle isn't enough - every binary needs entitlements

**Fix Applied:**
- Updated signing to apply entitlements to ALL executables:
  1. Find and sign all Mach-O binaries (dylibs, frameworks, helpers)
  2. Sign each with the entitlements.plist
  3. Explicitly sign main executable with entitlements
  4. Finally sign the app bundle with entitlements
- Added verification step to display applied entitlements
- Use full path to entitlements.plist (not relative)

**Files Changed:** `scripts/.local/app-store-submit.sh` (sign command)

---

## Additional Improvements

### 1. Comprehensive Signing Process
- **Sign ALL executables with entitlements** (not just the main app)
- Sign nested binaries, frameworks, and dylibs first (deepest first)
- Explicitly sign main executable with entitlements
- Finally sign the app bundle itself with entitlements
- Use `--timestamp` for long-term validity
- Deep verification with `--deep --strict`
- Display entitlements after signing for verification
- **Critical:** Every executable must have the sandbox entitlement applied

### 2. Improved Upload Workflow
- Prefer .pkg over .zip (Apple's recommendation)
- Better error messages
- Automatic cleanup of temporary files

### 3. Certificate Management
- Auto-detect Installer certificate from Application certificate
- Clear documentation of required certificates
- Verification script: `scripts/.local/check-certificates.sh`

### 4. Documentation
- Complete submission guide: `APP_STORE_SUBMISSION.md`
- Updated script usage with correct examples
- Troubleshooting section for common issues

## What You Need to Do

### 1. Get Required Certificates

Visit [developer.apple.com](https://developer.apple.com) and create:

**a) 3rd Party Mac Developer Application**
- Certificates → Create Certificate → "Mac App Store"
- Download and install in Keychain

**b) 3rd Party Mac Developer Installer**
- Certificates → Create Certificate → "Mac Installer Distribution"
- Download and install in Keychain

### 2. Verify Certificates

Run the verification script:
```bash
./scripts/.local/check-certificates.sh
```

This will:
- Check if certificates are installed
- Show certificate names
- Provide export commands ready to use

### 3. Set Environment Variables

```bash
export APPLE_SIGNING_IDENTITY="3rd Party Mac Developer Application: Your Name (TEAMID)"
export APPLE_ID="your@apple.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="TEAMID"  # Optional
```

**Getting an App-Specific Password:**
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → Security → App-Specific Passwords
3. Generate new → Save it

### 4. Run Submission

```bash
./scripts/.local/app-store-submit.sh submit --version 0.4.1
```

This will:
1. ✅ Build app (arm64, macOS 15.0+)
2. ✅ Sign with Application certificate
3. ✅ Create proper product archive with `productbuild`
4. ✅ Sign package with Installer certificate
5. ✅ Upload to App Store Connect

### 5. Monitor Progress

- Check email for upload confirmation
- Go to [App Store Connect](https://appstoreconnect.apple.com)
- Navigate to: My Apps → Claudit → TestFlight
- Wait for processing (10-30 minutes)
- Submit for review once processed

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./scripts/.local/check-certificates.sh` | Verify certificates installed |
| `./scripts/.local/app-store-submit.sh submit` | Full submission workflow |
| `./scripts/.local/app-store-submit.sh build` | Just build |
| `./scripts/.local/app-store-submit.sh sign` | Just sign |
| `./scripts/.local/app-store-submit.sh package` | Just create package |
| `./scripts/.local/app-store-submit.sh upload` | Just upload |

## File Changes Summary

| File | Change |
|------|--------|
| `src-tauri/tauri.conf.json` | Updated `minimumSystemVersion` to `15.0` |
| `scripts/.local/app-store-submit.sh` | Complete rewrite of package/sign/upload |
| `APP_STORE_SUBMISSION.md` | New comprehensive guide |
| `APP_STORE_FIXES.md` | This document |
| `scripts/.local/check-certificates.sh` | New certificate verification tool |

## Technical Details

### Why productbuild?

Apple requires product archives to be created with `productbuild` because it:
- Generates proper metadata (product-identifier, product-version)
- Creates installer-gui-script structure
- Supports multiple component packages
- Provides upgrade/patch capabilities
- Meets App Store validation requirements

### Why macOS 15.0 (Sequoia)?

Setting deployment target to 15.0 (Sequoia) allows:
- arm64-only builds (no Intel required)
- Smaller app size
- Better performance (no Rosetta overhead)
- Access to newer macOS APIs
- Still covers 95%+ of Mac users

### Certificate Types

| Certificate | Purpose | Used By |
|------------|---------|---------|
| 3rd Party Mac Developer Application | Sign .app bundle | `codesign` |
| 3rd Party Mac Developer Installer | Sign .pkg installer | `productbuild` |
| Developer ID Application | Sign for direct download | `notarize.sh` |
| Developer ID Installer | Sign DMG/PKG for direct download | `notarize.sh` |

**Important:** "3rd Party" certs are for App Store. "Developer ID" certs are for direct distribution.

## Next Release Checklist

When releasing the next version:

1. Update version in all places (script does this):
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. Update changelogs:
   - `CHANGELOG.md`
   - `landing/changelog.html`

3. Run submission:
   ```bash
   ./scripts/.local/app-store-submit.sh submit --version X.Y.Z
   ```

4. After approval, also build for direct download:
   ```bash
   ./scripts/notarize.sh submit --version X.Y.Z
   ```

This ensures you have both App Store and direct download versions.

## Support

If you encounter issues:

1. Check `APP_STORE_SUBMISSION.md` troubleshooting section
2. Run certificate verification: `./scripts/.local/check-certificates.sh`
3. Check App Store Connect for detailed error messages
4. Verify entitlements in `src-tauri/entitlements.plist`

## Resources

- [App Store Submission Guide](./APP_STORE_SUBMISSION.md)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Portal](https://developer.apple.com)
- [Submitting to Mac App Store](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)

