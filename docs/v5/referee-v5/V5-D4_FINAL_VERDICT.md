# V5-D.4 — Operational Staging Closure Verdict

**Date:** 2026-07-12  
**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Production ref:** `expuvcohlcjzvrrauvud` — **NOT TOUCHED**

---

## Summary

| Area | Verdict |
|------|---------|
| Atomic command rollback | **PASS** (3/3) |
| Atomic finalize rollback | **PASS** (4/4) |
| Fault injection security | **PASS** (4/4) |
| Multi-device conflict | **PASS** (6/6) |
| Replay/snapshot consistency | **PASS** (6/6) |
| Rollback rehearsal | **PASS** (6/6) |
| HTTP harness regression | **PARTIAL** (16/18) |
| Remote UI browser E2E | **BLOCKED** |
| Referee V5 unit | **PASS** (123/123) |
| Legacy referee | **PASS** (23/23) |
| Build | **PASS** |
| Lint | **FAIL** (pre-existing repo errors) |

**Staging operational verdict: CONDITIONAL GO**

**Production readiness: NO**

---

## Deliverables

- SQL: `docs/v5/referee-v5/PHASE_V5D4_ATOMIC_ROLLBACK.sql` (finalize fault injection)
- Evidence: `docs/v5/qa-evidence/phase-v5d4/`
- Scripts: `verify-referee-v5-*-staging.mjs`, `verify-referee-v5-d4-staging-closure.mjs`

---

## Blockers (P1)

1. **HTTP harness 16/18** — `player@staging.local` / `owner-b@staging.local` invalid credentials on staging; `unassigned_referee_denied` and `revoked_assignment_denied` cannot run. Reset via `STAGING_PLAYER_NEW_PASSWORD` / `STAGING_NON_COHORT_NEW_PASSWORD` (see password reset script).
2. **Remote UI browser E2E** — requires `STAGING_PREVIEW_URL` with `VITE_REFEREE_V5_ENABLED=true` + `VITE_REFEREE_V5_DATA_MODE=remote`, or working local Vite + login path to `/dev/referee-v5`.

---

## P0

**0**

---

## Recommended next phase

**V5-E — Realtime and offline** after:
- Browser E2E PASS on preview with remote flags
- HTTP harness 18/18 (staging QA passwords restored)

---

## Final response template

```text
REFEREE V5-D.4: CONDITIONAL COMPLETE

Atomicity:
- Command rollback: PASS
- Finalize rollback: PASS
- Retry after rollback: PASS
- Outbox rollback/deduplication: PASS

Fault injection:
- Browser blocked: PASS
- Test namespace restriction: PASS
- Disabled after testing: PASS

Remote UI:
- Remote adapter: PASS (code + HTTP path)
- No local fallback: PASS
- Doubles E2E: BLOCKED (preview/credentials)
- Singles E2E: BLOCKED (preview/credentials)
- Reload persistence: PASS (harness replay)

Multi-device:
- Stale version conflict: PASS
- Same-key idempotency: PASS
- Switch-ends conflict: PASS
- Undo conflict: PASS
- Device convergence after reload: PASS

Integrity:
- Replay/snapshot consistency: PASS
- Initial state integrity: PASS
- Event append-only integrity: PASS

Rollback rehearsal: PASS

Regression:
- HTTP harness: 16/18 PASS
- Referee V5: 123/123 PASS
- Legacy: 23/23 PASS
- Build: PASS
- Lint: FAIL (pre-existing)

Staging operational verdict: CONDITIONAL GO
Production readiness: NO
Production deployment: NOT PERFORMED
```
