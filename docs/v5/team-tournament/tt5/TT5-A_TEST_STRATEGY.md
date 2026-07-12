# TT-5A — Test Strategy

**Date:** 2026-07-13

---

## Post-merge baseline (verified this audit)

| Suite | Command | Result |
|-------|---------|--------|
| Referee V5 unit | `node --test tests/referee-v5/*.test.js` | 133/133 PASS |
| Referee V5 UI | `npx vitest run tests/ui/referee-v5-c.test.jsx` | 36/36 PASS |
| Realtime unit | included in `referee-v5-e1-realtime.test.js` | PASS |
| Legacy referee | `node --test tests/referee-engine.test.js tests/referee-polish.test.js tests/referee-flow.integration.test.js tests/referee-rpc-security.test.js` | 29/29 PASS |
| Team Tournament core | `team-tournament.test.js`, `team-tournament-referee.test.js`, `team-tournament-workflow.test.js` | 30/30 PASS |
| Team Tournament full | `node --test tests/team-tournament*.test.js` | 206/206 PASS |
| Build | `npm run build` | PASS |
| Scoped lint | `npm run lint:referee-v5` | PASS |

**Note:** Full 206 count exceeds handoff minimum 30/30 — no tests lost vs Referee V5 capture report.

---

## TT-5B unit tests (to add)

| File | Cases |
|------|-------|
| `tests/team-tournament-tt5-bridge.test.js` | Bridge row CRUD, status transitions |
| `tests/team-tournament-tt5-provision.test.js` | Mock RPC: lineup gate, idempotent provision |
| `tests/team-tournament-tt5-outbox-consumer.test.js` | Finalize → sub-match summary mapping |
| `tests/referee-v5/tt5-integration.test.js` | `match_id` = external_sub_match_id roundtrip |

---

## TT-5C staging scripts (to add)

| Script | Purpose |
|--------|---------|
| `scripts/verify-phase-tt5-staging-provision.mjs` | Publish lineup → provision → get-state |
| `scripts/verify-phase-tt5-staging-finalize.mjs` | Rally commands → finalize → TT sub-match row |
| `scripts/verify-phase-tt5-staging-idempotency.mjs` | Double finalize, double outbox delivery |

Evidence dir: `docs/v5/qa-evidence/phase-tt5/`

---

## TT-5D regression gates (each phase)

Must pass before next phase:

1. All baseline suites above
2. TT-4 staging verify (`verify-phase-tt4-staging.mjs`) — forfeit still works on **unlinked** sub-matches
3. Referee V5 staging closure (`qa:referee-v5:staging-closure`) — when secrets available
4. New TT-5 integration script PASS

---

## E2E scenarios (browser staging)

| ID | Scenario |
|----|----------|
| E01 | BTC publishes lineup → provision → referee opens `/referee/match/{external_sub_match_id}` |
| E02 | Rally scoring → realtime second device sees same score |
| E03 | Finalize → team portal standings update within poll interval |
| E04 | Linked sub-match — legacy confirm button disabled |
| E05 | Override revision → standings corrected |
| E06 | Unlinked sub-match — legacy confirm still works |

---

## Negative tests

| ID | Expect |
|----|--------|
| N01 | Provision before publish → blocked |
| N02 | Legacy confirm when link finalized → blocked |
| N03 | V5 command without assignment → 403 |
| N04 | Wrong tenant match_id → NOT_FOUND |
| N05 | Duplicate outbox consume → no double standings |

---

## Lint scope (TT-5B+)

- `npm run lint:referee-v5`
- ESLint on new `src/features/team-tournament/integrations/referee-v5/` (proposed path)
- Changed-files lint on merge commits

**TT-5A:** No new tests created — baseline verification only.
