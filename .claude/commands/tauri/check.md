---
description: Validate both frontend TypeScript and Rust backend in one command
category: workflow
allowed-tools: Bash(pnpm:*), Bash(cargo:*), Bash(echo:*)
---

# Tauri Project Validation

Run comprehensive type checking for both frontend (TypeScript) and backend (Rust) in a Tauri project.

## Steps:

1. Run both checks in parallel using a single bash command:

```bash
echo "=== Frontend TypeScript Check ===" && \
pnpm --filter frontend tsc --noEmit 2>&1; \
FRONTEND_EXIT=$?; \
echo "" && \
echo "=== Rust Backend Check ===" && \
cargo check --manifest-path src-tauri/Cargo.toml 2>&1; \
RUST_EXIT=$?; \
echo "" && \
if [ $FRONTEND_EXIT -eq 0 ] && [ $RUST_EXIT -eq 0 ]; then \
  echo "All checks passed"; \
else \
  echo "Some checks failed (Frontend: $FRONTEND_EXIT, Rust: $RUST_EXIT)"; \
  exit 1; \
fi
```

2. Report results:
   - If both pass: Report success with brief summary
   - If either fails: Report which check(s) failed and the specific errors

## Output Format:

```
=== Frontend TypeScript Check ===
[TypeScript output or "No errors"]

=== Rust Backend Check ===
[Cargo check output or "No errors"]

[Summary: All checks passed / Some checks failed]
```

## Notes:
- Frontend uses `pnpm --filter frontend tsc` for monorepo support
- Backend uses `cargo check` for fast validation without full build
- Both checks run sequentially but report individual exit codes
- Use before commits to catch cross-stack issues early
