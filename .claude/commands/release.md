---
description: Prepare and create a new release with synchronized versions
category: workflow
allowed-tools: Bash(git:*), Bash(grep:*), Bash(sed:*), Read, Edit
---

# Release Command for Claudit

Automate the release process: bump versions, update changelogs, commit, and tag.

## Arguments

- `$ARGUMENTS` - The new version number (e.g., "0.3.0") OR bump type ("patch", "minor", "major")

## Steps

1. **Parse version argument**
   - If numeric (e.g., "0.3.0"): use as-is
   - If bump type: calculate from current version
     - `patch`: 0.2.0 → 0.2.1
     - `minor`: 0.2.0 → 0.3.0
     - `major`: 0.2.0 → 1.0.0

2. **Read current version** from `package.json` to verify sync

3. **Update versions in all files** (use Edit tool for each):
   - `package.json` - update `"version": "X.Y.Z"`
   - `src-tauri/Cargo.toml` - update `version = "X.Y.Z"`
   - `src-tauri/tauri.conf.json` - update `"version": "X.Y.Z"`

4. **Update CHANGELOG.md**:
   - Add new version header after "# Changelog" line
   - Format: `## [X.Y.Z] - YYYY-MM-DD`
   - Include sections: Added, Changed, Fixed, Removed (as applicable)
   - Ask user what changes to include if not obvious from git diff

5. **Update landing/changelog.html**:
   - Add new release section at the top of the releases list
   - Use the same content as CHANGELOG.md
   - Follow existing HTML structure

6. **Verify all versions match**:
   ```bash
   grep -h '"version"' package.json src-tauri/tauri.conf.json && grep '^version' src-tauri/Cargo.toml
   ```

7. **Create release commit**:
   ```bash
   git add -A && git commit -m "Release vX.Y.Z"
   ```

8. **Create and push git tag**:
   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
   Note: Only push tag if user confirms

## Example Usage

```
/release 0.3.0
/release patch
/release minor
```

## Files Modified

| File | Field |
|------|-------|
| `package.json` | `"version": "X.Y.Z"` |
| `src-tauri/Cargo.toml` | `version = "X.Y.Z"` |
| `src-tauri/tauri.conf.json` | `"version": "X.Y.Z"` |
| `CHANGELOG.md` | New version section |
| `landing/changelog.html` | New release section |

## Important Notes

- Always run `/tauri:check` before releasing to ensure build passes
- The git tag triggers the GitHub Actions release workflow
- After tagging, the release build starts automatically
