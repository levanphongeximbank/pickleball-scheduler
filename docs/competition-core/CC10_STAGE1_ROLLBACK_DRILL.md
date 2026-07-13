# CC-10 Stage 1 — Rollback Drill

**Environment:** Simulated (Vercel flags NOT CHANGED)

## Procedure

1. **Recorded** recommended SHADOW flag set (`CC10_STAGE1_FLAG_SNAPSHOT.md`)
2. **Simulated disable:** `SHADOW_ENV` all flags `false` → `resolveCompetitionCoreExecutionMode()` returns legacy-only (unit tests in `competition-core-cc10-readiness.test.js`)
3. **Verified** legacy-only path via existing flag-OFF unit suites (CC-03–09)
4. **Re-enable:** SHADOW config safe to re-apply; no data reconciliation required (no canonical writes in Stage 1 harness)

## Staging Vercel rollback

**NOT PERFORMED** on live Preview — owner applies flag OFF via Vercel dashboard when needed.

## Production rollback

**NOT APPLICABLE** — Production flags remain OFF.
