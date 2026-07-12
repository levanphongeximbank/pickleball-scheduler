# TT-5A — Final Verdict

**Date:** 2026-07-13  
**Auditor phase:** TT-5A read-only  
**Owner pre-flight:** APPROVED

---

## Integration baseline

| Field | Value |
|-------|-------|
| Worktree | `C:\Users\Le Phong\pickleball-scheduler-tt5-referee-integration` |
| Integration branch | `feature/tt5-referee-v5-integration` |
| Team Tournament base SHA | `cb32ae2669182a81ac1cc1f41ad00f51b58b933c` |
| Referee V5 source SHA | `a678229e7cfba7736d0f62f7d3824d3816175721` |
| Merge commit SHA | `2140c81782dfdd738bf42603b7bcf7f8df9ed356` |
| Merge conflicts | **None** |
| Working tree after merge | **CLEAN** |
| Stale SHA `2346287…` used | **NO** |

---

## Mandatory decisions (TT-5A answers)

| # | Question | Verdict |
|---|----------|---------|
| 1 | Sub-match → V5 match ID | **EXTERNAL_SUB_MATCH_ID** as V5 `match_id` |
| 2 | Bridge table | **RECOMMENDED** (`team_sub_match_referee_links`) |
| 3 | Live-state creation | **After lineup publish + referee assignment** via TT-5C provision RPC |
| 4 | Lineup leak prevention | Server `get_visible_lineups` + **must add** provision gate (P0) |
| 5 | Legacy score when linked | **LOCK WHEN LINKED** (read-only summary allowed) |
| 6 | V5 finalize emits | `match_result_revisions` + `match_integration_outbox` (`STANDINGS_RECALC_REQUESTED`, etc.) |
| 7 | TT consumer updates | Outbox worker → sub-match summary → matchup recompute → standings cache |
| 8 | Anti-double-count | Idempotency keys, revision monotonic, bridge last_applied_revision, RPC version locks |
| 9 | Revision override | New revision → consumer replaces summary → full standings recompute |
| 10 | Official route | **`/referee/match/:matchId`** (matchId = external_sub_match_id); `/team-referee/:id` stays navigator |
| 11 | Offline V5-E2 | **NON-BLOCKING** for online pilot design; **BLOCKING** for production pilot if offline required |
| 12 | DreamBreaker / MLP | **OUT OF TT-5** scope — legacy portal retains |

---

## Source of truth boundary — **FEASIBLE**

| Domain | Authority |
|--------|-----------|
| Referee V5 | Live score, events, serve/receive, revisions, official finalize |
| Team Tournament | Teams, published lineup, matchup aggregate, standings, tournament state |

Boundary enforceable **after** TT-5B–E implement bridge, provision, outbox consumer, and lock legacy writes.

---

## Findings

### P0

| ID | Finding |
|----|---------|
| P0-1 | No code bridge between modules — dual scoring would corrupt data if both enabled |
| P0-2 | No outbox consumer to TT tables |
| P0-3 | No V5 provision API — cannot create live state from TT publish event |
| P0-4 | No lineup gate on V5 side — leak risk if provision added without TT checks |

### P1

| ID | Finding |
|----|---------|
| P1-1 | Three standings update paths — must converge on outbox + TT-4 only |
| P1-2 | `/referee/match/:id` still legacy scoreboard — route swap needed in TT-5E |
| P1-3 | Two permission models — need assignment provisioning from TT roles |
| P1-4 | Rally rule duplication between TT and V5 engines |

### P2

| ID | Finding |
|----|---------|
| P2-1 | Dreambreaker only in TT — parallel ops during pilot |
| P2-2 | Handoff doc references superseded SHA `2346287…` — update in TT-5B |
| P2-3 | Post-TT-4 rating-v5 commits on TT branch — unrelated to TT-5 but present in integration base |

---

## TT-5A status

**COMPLETE**

| Gate | Result |
|------|--------|
| Worktree + merge | PASS |
| Regression | PASS |
| Audit documents | 9/9 created |
| Runtime code changes | NONE |
| SQL | NOT CREATED OR APPLIED |
| Deployment | NOT PERFORMED |
| Production | UNTOUCHED |

---

## TT-5B readiness

**YES** — owner may proceed to TT-5B schema + bridge design **after reviewing this audit**.

Conditions:

- Approve EXTERNAL_SUB_MATCH_ID mapping
- Approve bridge table schema
- Approve LOCK WHEN LINKED policy
- Approve outbox consumer architecture

**Do not start TT-5B implementation in same approval as TT-5A sign-off without explicit owner GO.**

---

## Next phase

**TT-5B** — Bridge schema, provision RPC design, legacy lock guards (staging only).

---

## Document index

| File | Purpose |
|------|---------|
| `TT5-A_CURRENT_STATE_AUDIT.md` | Baseline inventory |
| `TT5-A_DATA_MODEL_MAPPING.md` | ID + entity mapping |
| `TT5-A_DUPLICATE_LOGIC_REPORT.md` | Overlap / conflicts |
| `TT5-A_RESULT_PROPAGATION_AUDIT.md` | Finalize → TT flow |
| `TT5-A_ROUTE_INTEGRATION_AUDIT.md` | URL strategy |
| `TT5-A_SECURITY_RLS_AUDIT.md` | RLS + leak controls |
| `TT5-A_MIGRATION_PROPOSAL.md` | Phased SQL plan (not applied) |
| `TT5-A_TEST_STRATEGY.md` | Gates + future tests |
| `TT5-A_FINAL_VERDICT.md` | This document |
