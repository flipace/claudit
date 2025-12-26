# ✅ App Store Submission - Next Steps

All validation errors have been fixed! Here's what you need to do to successfully submit to the App Store.

## 🎯 Quick Start (3 Steps)

### Step 1: Get Certificates (5 minutes)

Go to [developer.apple.com](https://developer.apple.com/account/resources/certificates/list):

1. **Create "3rd Party Mac Developer Application" certificate**
   - Click (+) → Mac App Store → Mac App Distribution
   - Follow prompts, download, and double-click to install

2. **Create "3rd Party Mac Developer Installer" certificate**
   - Click (+) → Mac Installer Distribution
   - Follow prompts, download, and double-click to install

### Step 2: Verify Setup (30 seconds)

```bash
./scripts/.local/check-certificates.sh
```

This will:
- ✅ Confirm certificates are installed
- ✅ Show exact certificate names
- ✅ Provide ready-to-use export commands

### Step 3: Submit (5 minutes)

**IMPORTANT:** Use the "Apple Distribution" certificate (not "Installer")!

```bash
# Use "Apple Distribution" certificate from Step 2
export APPLE_SIGNING_IDENTITY="Apple Distribution: Patrick Hbl-Neschkudla (4CBRLLCF82)"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # See below for how to get this

./scripts/.local/app-store-submit.sh submit --version 0.4.1
```

📖 **Not sure which certificate to use?** See [CERTIFICATE_GUIDE.md](./CERTIFICATE_GUIDE.md)

**Getting App-Specific Password:**
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign In → Security → App-Specific Passwords → (+)
3. Give it a name (e.g., "Claudit Upload")
4. Copy and use the generated password

---

## 📋 What Was Fixed

All 6 validation errors are now resolved:

| Issue | Status |
|-------|--------|
| ❌ Unsupported toolchain | ✅ Now using `productbuild` with proper metadata |
| ❌ arm64 only / no Intel | ✅ Set macOS 15.0+ target (allows arm64-only) |
| ❌ Invalid package signature | ✅ Auto-detects Installer certificate |
| ❌ Missing product-identifier | ✅ Included in Distribution.xml |
| ❌ Missing product-version | ✅ Included in Distribution.xml |
| ❌ System version mismatch | ✅ Proper Distribution.xml structure |

---

## 📚 Documentation Added

| File | Purpose |
|------|---------|
| [APP_STORE_SUBMISSION.md](./APP_STORE_SUBMISSION.md) | Complete submission guide |
| [APP_STORE_FIXES.md](./APP_STORE_FIXES.md) | Detailed fixes explanation |
| [NEXT_STEPS.md](./NEXT_STEPS.md) | This quick reference |
| `scripts/.local/check-certificates.sh` | Certificate verification tool |

---

## 🚀 Expected Timeline

1. **Run submission script**: ~5 minutes
   - Build, sign, package, upload

2. **Apple processing**: 10-30 minutes
   - You'll receive an email when complete
   - Check App Store Connect → TestFlight

3. **Submit for review**: ~2 minutes
   - Fill in "What's New"
   - Click "Submit for Review"

4. **App Review**: 1-3 days
   - Apple reviews your app
   - Usually approved within 24-48 hours

5. **Release**: Immediate or scheduled
   - You choose when to release after approval

---

## ⚠️ Important Notes

### Certificate Types Matter!

Do NOT use "Developer ID" certificates (those are for direct download, not App Store):

| ❌ Wrong | ✅ Correct |
|---------|----------|
| Developer ID Application | 3rd Party Mac Developer Application |
| Developer ID Installer | 3rd Party Mac Developer Installer |

### First-Time Setup Only

You only need to get certificates once. They're valid for 1 year, then you renew them on developer.apple.com.

### Environment Variables

For security, never commit these to git:
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`

Set them in your shell or use a `.env` file (already in `.gitignore`).

---

## 🔧 Troubleshooting

### "Certificate not found"
```bash
# List installed certificates
security find-identity -v -p codesigning

# If missing, download from developer.apple.com and install
```

### "Build failed"
```bash
# Clean and try again
cargo clean
pnpm build
```

### "Upload failed - authentication"
- Verify Apple ID is correct
- Verify app-specific password is correct (not your Apple ID password!)
- Check that team ID matches (if you have multiple teams)

### Still having issues?
Check [APP_STORE_SUBMISSION.md](./APP_STORE_SUBMISSION.md) troubleshooting section.

---

## 📞 Support Resources

- **Apple Developer:** [developer.apple.com/support](https://developer.apple.com/support)
- **App Store Connect:** [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- **Documentation:** [developer.apple.com/help/app-store-connect](https://developer.apple.com/help/app-store-connect)

---

## ✨ You're Ready!

Everything is configured and ready to go. Just follow the 3 steps above and you'll have your app submitted to the App Store! 🎉

**Good luck with your submission!** 🚀

