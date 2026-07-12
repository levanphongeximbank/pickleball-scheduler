# V5-D.3 — Final Verdict

**Date:** 2026-07-12  
**Phase:** Referee V5-D.3 / V5-D.3.2 — Edge Deployment & Staging Closure

---

## Environment

| Item | Value |
|------|-------|
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Production project verified different | **YES** |
| Secrets present without exposure | **YES** (PAT + service role + anon; no values logged) |

---

## Runtime verification (2026-07-12 closure)

| Gate | Status |
|------|--------|
| Full staging seed | **PASS** — 4 matches, 5 assignments |
| Edge deployed | **PASS** — `referee-v5-match` live |
| JWT verified server-side | **PASS** |
| Unassigned / revoked / expired denied | **PASS** |
| Cross-tenant read blocked | **PASS** |
| Internal commit RPC blocked | **PASS** |
| HTTP commands (incl. UNDO) | **PASS** |
| Optimistic locking C1 | **PASS** |
| Idempotency duplicate C2 | **PASS** |
| Idempotency mismatch C3 | **PASS** |
| Undo EVENT_REVERTED / replay hash | **PASS** |
| Fake actor never trusted | **PASS** |

**HTTP harness: 18/18 PASS** (`verify-referee-v5-http-concurrency-staging.mjs`)

Evidence: `docs/v5/qa-evidence/phase-v5d3/`

---

## V5-D.3.2 fixes applied

1. **Idempotency C2** — RPC re-checks `match_sync_mutations` after `FOR UPDATE` lock; edge re-checks before commit; removed pre-RPC client version validation race.
2. **Idempotency C3** — Hash mismatch returned before version conflict when key exists; harness refreshes version after C2.
3. **HTTP UNDO** — `p_state_before` captured on START; `_initialState` stored in first event; `getInitialState` reads it; `verifySnapshotMatchesReplay` replays via `dispatchMatchCommand` (incl. UNDO).
4. **Fake actor harness** — Accepts `VALIDATION_FAILED` or success with verified JWT actor in audit.
5. **Seed reset** — `session_replication_role = replica` only in test seed path; always restored to `origin`.

SQL: `docs/v5/referee-v5/PHASE_V5D32_IDEMPOTENCY_UNDO.sql` (staging migration `phase_v5d32_idempotency_undo`)

---

## Regression

| Suite | Result |
|-------|--------|
| Referee V5 unit | **123/123 PASS** |
| Legacy referee | **19/19 PASS** |
| Build | **PASS** |
| Lint (referee-v5 + D.3 scripts) | **PASS** |

---

## Findings

### P0

None.

### P1

None open — idempotency C2/C3 and HTTP undo closed in V5-D.3.2.

### P2

- Atomic rollback harness, remote UI E2E, multi-device, rollback rehearsal — not in HTTP harness scope; track for full V5-D closure or V5-E prep.

---

## Staging verdict

### **GO** (HTTP runtime gates for V5-D.3.2)

---

## Production readiness

**NO**  
**Production deployment: NOT PERFORMED**

---

## Recommended next phase

**V5-E** — realtime/offline (authorized after staging GO)
