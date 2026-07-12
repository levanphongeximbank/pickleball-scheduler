# Team Tournament TT-2D — Randomize & Lock Workflow

Phase TT-2D adds **server-side missing-lineup handling** for team tournaments on staging.

## Scope (TT-2D only)

- Missing-lineup policies: `random`, `forfeit_pending`, `manual_pending`
- Server-side randomize (`team_tournament_randomize_lineup`)
- Concurrency-safe commands (`expected_version`, `idempotency_key`, row locks)
- Policy-aware lock (`team_tournament_lock_matchup`)
- BTC UI: submit status, deadline, missing teams, randomize/lock buttons, server `canLock`
- Audit for randomize/lock actions

## Out of scope

- TT-2E publish atomicity
- TT-4 full forfeit
- TT-3 BTC override lineup
- Realtime / DreamBreaker changes
- Production deploy

## SQL (staging)

Apply:

```bash
node scripts/apply-phase-tt2d-staging-sql.mjs
```

File: `docs/v5/PHASE_TT2D_RANDOMIZE_LOCK_WORKFLOW.sql`

## Verification

```bash
node scripts/verify-phase-tt2d-staging.mjs
node --test tests/team-tournament-tt2d.test.js
npm run build
```

Evidence:

- `docs/v5/qa-evidence/phase-tt2/TT2D_RANDOMIZE_REPORT.json`
- `docs/v5/qa-evidence/phase-tt2/TT2D_LOCK_REPORT.json`
- `docs/v5/qa-evidence/phase-tt2/TT2D_CONCURRENCY_REPORT.json`
- `docs/v5/qa-evidence/phase-tt2/TT2D_STAGING_SMOKE_REPORT.json`

## Verdict gate (TT-2E)

**READY FOR TT-2E** when all checks below pass (owner review required before starting TT-2E):

| Check | Status |
|-------|--------|
| Randomize server-side | PASS (staging) |
| Concurrency / idempotency | PASS (staging) |
| Missing-lineup policy | PASS (unit + SQL) |
| Lock server-side | PASS (staging) |
| Captain blocked after lock | PASS (staging) |
| BTC UI wiring | PASS (code) |
| Audit metadata | PASS (SQL) |
| Unit tests TT-2D | PASS |
| Build | PASS |
| Production impact | NONE |

Current staging evidence verdict: **PASS** (see JSON reports). Owner must confirm before TT-2E.
