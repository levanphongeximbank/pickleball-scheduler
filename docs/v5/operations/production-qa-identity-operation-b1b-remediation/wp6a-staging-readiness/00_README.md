# WP6A — Staging Rehearsal Readiness Remediation

**Mode:** `WP6A_MODE=READINESS_REMEDIATION`  
**STAGING_APPLY_GO:** NO  
**AUTH_MUTATION_GO:** NO  
**PRODUCTION_GO:** NO  
**PUSH:** NO (local readiness only)

Base main SHA recorded at branch start: see `WP6A_READINESS_REPORT.json`.

## Purpose

Remediate the three WP6 read-only preflight blockers to readiness level so Independent Re-review can proceed **before** Owner considers `STAGING_APPLY_GO`.

| Blocker | Remediation artifact |
|---------|----------------------|
| G1 Staging backup/recovery evidence | `01_STAGING_BACKUP_RECOVERY_AUDIT.md`, `02_STAGING_BACKUP_OWNER_CONFIRMATION.*` |
| G6 Disposable Staging QA package | `03_STAGING_QA_IDENTITY_PACKAGE.md`, designation + templates + checksums |
| Staging-safe runner binding | Runner `OPERATION_TARGET_MODE=staging_rehearsal` + `04_STAGING_SAFE_RUNNER_RUNBOOK.md` + tests |

## Hard stops (still NO)

- No Staging SQL apply
- No Auth ban/unban
- No writer RPC invoke
- No Production access/mutation
- No WP7 Production authorization package
- No reuse of Production allowlist / batch / GO / recovery snapshot

## Next after Independent Re-review

1. Owner completes Staging backup confirmation (`02_*.json` → `status=completed`)
2. Owner issues separate Staging QA provision GO (create disposable `@staging-qa.local` identities)
3. Bind live allowlist + recovery snapshot **outside Git**, refresh SHA-256
4. Owner considers `STAGING_APPLY_GO` for WP6 execution (separate decision)
