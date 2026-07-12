# V5-D.2 — Final Verdict

**Date:** 2026-07-12  
**Phase:** Referee V5-D.2 Staging Apply & Verification

---

## Environment

| Item | Value |
|------|-------|
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Production project | `expuvcohlcjzvrrauvud` (verified different) |
| Feature flag staging | `VITE_REFEREE_V5_ENABLED=true` when testing (not deployed to preview yet) |
| Feature flag production | `false` |

---

## Gate summary

| Gate | Result |
|------|--------|
| Migrations apply cleanly | **PASS** |
| Object verification | **PASS** |
| SECURITY DEFINER hardening | **PASS** |
| Internal RPC browser access blocked | **PASS** |
| Edge JWT verification | **P1** (not deployed) |
| RLS role tests | **PASS** (6/6 JWT runtime) |
| Tenant isolation | **PASS** |
| Real DB optimistic locking | **P1** |
| Real DB idempotency | **P1** |
| Append-only trigger | **PASS** |
| Atomic event rollback | **PASS** (unit) |
| Atomic finalize rollback | **PASS** (unit) |
| Outbox deduplication | **PASS** (schema + RPC) |
| Remote UI adapter | **P1** |
| Legacy regression | **PASS** |
| Rollback rehearsal | **CONDITIONAL PASS** |
| Build | **PASS** |
| Referee unit tests | **123/123 PASS** |

---

## Findings

### P0

None.

### P1 (documented, accepted for staging phase)

1. **Edge Function not deployed** — local env lacks `SUPABASE_ACCESS_TOKEN`; bundle/deploy scripts added but not executed.
2. **Real DB concurrency + E2E** — blocked on Edge deploy; covered by in-memory unit tests (123 tests).
3. **Remote UI adapter on staging preview** — requires Edge + Vercel staging env flag.
4. **ASSIGNMENT_EXPIRED/REVOKED via Edge** — seed data ready; runtime proof pending Edge.

### P2

- Full seed SQL (`SEED_SQL.sql`) partially applied via MCP; run `seed-referee-v5-test-staging.mjs` with token for complete fixture set.
- `verify-phase-v5d2-staging.mjs` schema checks require token or MCP parallel run.

---

## Staging verdict

### **CONDITIONAL GO — STAGING ONLY**

Migrations and RLS/security gates pass on staging. Edge deploy and live E2E remain open P1 items before promoting to preview QA sign-off.

---

## Production readiness

**NO**

## Production deployment

**NOT PERFORMED**

---

## Recommended next phase

**V5-E** — Realtime, offline queue, operational hardening  
**Immediate:** Deploy Edge functions with PAT → run HTTP concurrency harness → enable staging preview flag

---

## Completion block

```
REFEREE V5-D.2 STAGING: COMPLETE (CONDITIONAL)

Environment:
- Staging project: qyewbxjsiiyufanzcjcq
- Production project: expuvcohlcjzvrrauvud — verified different
- Feature flag staging: true when testing (manual env)
- Feature flag production: false

Migrations:
- V5A: PASS
- V5D: PASS
- V5D1: PASS

Database:
- Objects: PASS
- Constraints/indexes: PASS
- SECURITY DEFINER: PASS
- Append-only enforcement: PASS

Security:
- Edge JWT verification: P1 (deploy pending)
- Internal RPC browser access blocked: PASS
- RLS: 6/6 PASS
- Tenant isolation: PASS

Integrity:
- Real DB optimistic locking: P1
- Real DB idempotency: P1
- Request-hash mismatch rejection: PASS (unit + SQL)
- Atomic event rollback: PASS (unit)
- Atomic finalize rollback: PASS (unit)
- Outbox deduplication: PASS (schema)
- Replay/snapshot consistency: PASS (unit)

UI staging:
- Remote adapter: P1
- Engine/display (unit): PASS

Regression:
- V5-B/C/D/D1 unit: PASS (123)
- Legacy referee: PASS (9)
- Build: PASS

Rollback rehearsal: CONDITIONAL PASS

Production readiness: NO
Production deployment: NOT PERFORMED
```
