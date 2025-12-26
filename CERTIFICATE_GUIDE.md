# App Store Certificate Guide

## ⚠️ IMPORTANT: Use the RIGHT Certificate for Each Step!

You have **TWO** certificates. Use the correct one for each task:

## Your Certificates

Run this to see them:
```bash
security find-identity -v -p codesigning
```

You should have:
1. ✅ **Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)**
2. ✅ **3rd Party Mac Developer Installer: Patrick Hbl-Neschkudla (4CBRLLCF82)**

---

## Certificate Usage Table

| Task | Use This Certificate | ❌ NOT This One |
|------|---------------------|-----------------|
| Sign `.app` bundle | **Apple Distribution** | ~~Installer~~ |
| Sign `.pkg` package | **3rd Party Mac Developer Installer** | ~~Distribution~~ |

---

## Correct Commands

### Option 1: Full Automated Workflow (RECOMMENDED)

```bash
export APPLE_SIGNING_IDENTITY="Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"

./scripts/.local/app-store-submit.sh submit --version 0.4.1
```

The script will:
- Sign app with "Apple Distribution" ✅
- Auto-convert to "Installer" cert for .pkg ✅

---

### Option 2: Step-by-Step

#### Step 1: Sign the APP
```bash
./scripts/.local/app-store-submit.sh sign \
  --signing-identity "Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)"
```

#### Step 2: Create PKG (script handles cert conversion)
```bash
./scripts/.local/app-store-submit.sh package \
  --signing-identity "Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)"
```

Note: The package command will automatically use the Installer cert for the .pkg

#### Step 3: Upload
```bash
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"

./scripts/.local/app-store-submit.sh upload
```

---

## ❌ Common Mistakes

### WRONG: Using Installer cert for app signing
```bash
# ❌ DON'T DO THIS
./scripts/.local/app-store-submit.sh sign \
  --signing-identity "3rd Party Mac Developer Installer: ..."
```

**Why it's wrong:** Installer certificates can only sign `.pkg` files, not `.app` bundles.

**What happens:** App isn't properly signed → Sandbox validation fails → Upload rejected

---

### WRONG: Manually specifying Installer cert for package
```bash
# ❌ DON'T DO THIS
./scripts/.local/app-store-submit.sh package \
  --signing-identity "3rd Party Mac Developer Installer: ..."
```

**Why it's wrong:** You should provide the Application/Distribution cert, and let the script auto-convert to Installer.

**Better:** Provide "Apple Distribution" cert, script handles conversion.

---

## ✅ Quick Reference

Always start with "Apple Distribution" certificate:

```bash
export APPLE_SIGNING_IDENTITY="Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)"
```

The script will automatically:
- Use "Apple Distribution" for signing the `.app` ✅
- Convert to "Installer" cert for signing the `.pkg` ✅

---

## Verification

After signing, verify the app has proper entitlements:

```bash
codesign -d --entitlements - src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Claudit.app
```

You should see:
```xml
<key>com.apple.security.app-sandbox</key>
<true/>
```

If you don't see this, the app wasn't signed with the correct certificate!

---

## Need Help?

Run the certificate check script:
```bash
./scripts/.local/check-certificates.sh
```

This will show you which certificates you have and provide the correct export commands.

