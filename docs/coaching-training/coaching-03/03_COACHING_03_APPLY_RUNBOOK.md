# COACHING-03 — Controlled Apply Runbook (Gate D — NOT authorized yet)

## Default behaviour

```bash
node scripts/coaching/coaching-03-staging-apply.mjs
```

Prints `APPLY_MODE=REFUSED` and exits without network write.

## Live execute (future only — requires Owner GO)

All required simultaneously:

```bash
# Illustrative — DO NOT RUN until Owner grants GO
node scripts/coaching/coaching-03-staging-apply.mjs \
  --execute \
  --environment=staging \
  --project-ref=qyewbxjsiiyufanzcjcq \
  --expected-commit=<exact-HEAD-sha> \
  --owner-go=COACHING_03_OWNER_GO_APPLY_STAGING \
  --preflight-pass
```

Env equivalents:

- `COACHING_03_OWNER_GO=COACHING_03_OWNER_GO_APPLY_STAGING`
- `COACHING_03_STAGING_TARGET_CONFIRM=qyewbxjsiiyufanzcjcq`
- `COACHING_03_EXPECTED_COMMIT=<sha>`

## Guard checklist

| # | Guard | Fail → |
|---|-------|--------|
| 1 | `--execute` present | REFUSED |
| 2 | Exact Staging project ref | REFUSED |
| 3 | Exact expected git commit = HEAD | REFUSED |
| 4 | Clean worktree | REFUSED |
| 5 | Preflight PASS | REFUSED |
| 6 | SQL checksums match manifest | REFUSED |
| 7 | GO token exact | REFUSED |
| 8 | environment=staging | REFUSED |
| 9 | Not Production ref | REFUSED |
| 10 | productionAllowed=false | REFUSED |

Missing any condition → stop **before** network write. Print `APPLY_MODE=REFUSED`.

## Apply plan (authored; not executed now)

1. Re-verify Staging project identity
2. Re-verify schema preconditions / collisions / auth helpers / permission tables
3. Lock checksums via `verifyCoaching03MigrationManifest`
4. Apply forward SQL **exact order** 10→15→20→30→40→45→50→60
5. Optionally apply role-grant proposal **only if** `roleMatrixApproved` in Owner GO
6. Stop on first error — no continue-on-error
7. Save sanitized apply evidence
8. Never log secrets
9. No automatic rollback (Owner decides per `05_COACHING_03_ROLLBACK_AND_RECOVERY.md`)

## Transaction model

| Channel | Atomicity |
|---------|-----------|
| Owner SQL Editor wrapping 10→60 | Single transaction possible (all files transaction-safe; no `CONCURRENTLY`) |
| Scripted Management API (one file / request) | **Not** cross-file atomic — per-file checkpoints; stop on first failure; rollback boundary = last successful checkpoint |

Do **not** claim full-package atomicity for scripted Management API apply.

## Checkpoints

1. after-tables  
2. after-permission-seed  
3. after-indexes  
4. after-rls  
5. after-attendance-rpc  
6. after-entitlement-rpc  
7. after-grants  
8. after-immutable  
9. after-role-grants (optional / Owner-approved)

## Forbidden

- No package.json apply shortcut
- No CI / deploy / startup auto-apply
- No Production URL
- No silent continue-on-error
