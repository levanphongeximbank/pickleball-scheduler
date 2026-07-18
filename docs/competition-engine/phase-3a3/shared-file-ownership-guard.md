# Shared-file Ownership Guard — Phase 3A.3

## Decision

```text
Option E — Lightweight validation script + documentation
(not a hard CI gate on every PR yet; available for Integrator/Owner checks)
```

## Script

```text
scripts/ci/competition-shared-file-ownership.mjs
```

### Usage

```powershell
# Capability chat self-check before PR
node scripts/ci/competition-shared-file-ownership.mjs --phase=3b --files=src/features/competition-core/index.js

# From git changed files
git diff --name-only origin/main...HEAD | node scripts/ci/competition-shared-file-ownership.mjs --phase=3b --files=-

# List protected files
node scripts/ci/competition-shared-file-ownership.mjs --list-protected
```

### Semantics

| Phase | May touch protected files? |
|-------|----------------------------|
| `3a3`, `integrator`, `i`, `3m`, `3n`, `3p` | YES |
| `3b`–`3l` (capability) | NO — exit 1 |

## Why not Chat-aware CI by default

CI has no reliable “which Codex chat” metadata. Phase identifier is explicit input — deterministic, offline, maintainable.

## Protected list source

Aligned with `docs/competition-engine/phase-3p/shared-file-protection.md` plus registry barrels and this guard script itself.
