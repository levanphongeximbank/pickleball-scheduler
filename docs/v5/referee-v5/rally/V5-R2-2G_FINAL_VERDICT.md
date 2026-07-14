# REFEREE V5-R2-2G — FINAL VERDICT

**Phase:** Team Tournament Rally Integration  
**Date:** 2026-07-14  
**Branch:** `feature/referee-v5-rally-scoring`  
**Baseline:** `63b50adfdf9989386537006d8848ab193d369c87`

---

## Verdict

| Gate | Result |
|------|--------|
| R2-2G | **COMPLETE** |
| Staging verdict | **GO** |
| Production readiness | **NO** |
| Production | **UNTOUCHED** |
| SQL production | **NOT APPLIED** |
| Deployment | **STAGING ONLY** |

---

## Audit mapping (pre-change)

| Concern | Location |
|---------|----------|
| Tournament scoring config | `DEFAULT_TEAM_TOURNAMENT_SETTINGS.scoringFormat`, `team_tournaments.settings` |
| Discipline scoring | `normalizeDiscipline` → `scoringFormat` |
| Sub-match creation | Team Tournament engine + cloud RPCs |
| Provision flow | `TT5-B_PROVISION_RPC.sql` → **R2-2G_PROVISION_MAP.sql** |
| Bridge links | `team_sub_match_referee_links` |
| Result consumer | `team_tournament_consume_referee_v5_outbox` |
| Standings | `team_tournament_recompute_standings_cache` (format-agnostic) |
| Legacy lock | `team_tournament_sub_match_score_ops` |
| Rollback | `R2-2G_ROLLBACK.sql` + flag OFF |

---

## Configuration

| Item | Result |
|------|--------|
| Tournament default | PASS |
| Discipline override | PASS |
| Sub-match override | PASS |
| Unsupported formats rejected | PASS (Singles Rally, MLP/freeze) |
| Format immutable | PASS (after provision/start) |

Flag: `VITE_TT5_REFEREE_V5_RALLY_ENABLED` default **false**.

---

## Provision (P0-06)

| Item | Result |
|------|--------|
| Rally mapping | PASS — `scoringSystem/targetScore` → V5 USAP fields |
| scoringVariant | `USAP_2026_PROVISIONAL_RALLY` |
| pointsToWin / winBy | 11 / 2 |
| Idempotency | PASS (single link) |
| Duplicate V5 match | PASS prevented |
| Column `scoring_system` | lowercase `rally` \| `side_out` (check constraint) |

---

## Legacy lock

| Item | Result |
|------|--------|
| Legacy live scoring blocked | PASS |
| Legacy finalize blocked | PASS (existing TT-5B guards) |
| Side-Out when unlinked | PASS unchanged |

---

## Official result

| Item | Result |
|------|--------|
| Final result applied | PASS |
| Winner / team points / standings once | PASS |
| Duplicate ignored | PASS |
| Stale revision | PASS (unit) |
| Correction revision | PASS (TT-5D request/approve on staging) |
| Live / undo before finalize | PASS (no standings) |

---

## Best-of

| Item | Result |
|------|--------|
| 2-0 | PASS |
| 2-1 | PASS |
| No forced third after 2-0 | PASS |

---

## Staging E2E

`TT Rally config → provision V5 → finalize → consumer → sub-match → standings`  
**13/13 PASS** — evidence: `docs/v5/qa-evidence/referee-v5-rally/r2-2g/`

Probe disciplines restored to Side-Out after verification.

---

## Findings

| Severity | Finding |
|----------|---------|
| P0 | **None remaining** — P0-06 fixed |
| P1 | V5 multi-game progression still limited; TT consumes finalized contract only |
| P2 | Full `test:ui` has 1 unrelated app-shell failure; referee UI 52/52 PASS |

---

## Rollback

1. Set `VITE_TT5_REFEREE_V5_RALLY_ENABLED=false`
2. Optionally apply `docs/v5/team-tournament/tt5/R2-2G_ROLLBACK.sql` on staging
3. Do **not** delete finalized results / links

---

## Production

**Do not start Production rollout.**
