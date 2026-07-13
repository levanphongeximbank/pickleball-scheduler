# TT-5A — Duplicate Logic Report

**Date:** 2026-07-13

---

## P0 — Dual live scoring paths

| Path | Writer | Target | When |
|------|--------|--------|------|
| Legacy team referee | `saveSubMatchDraft` → `team_tournament_save_sub_match_draft` | `team_tournament_sub_matches.score`, status `playing` | Every draft save in `TeamRefereePortal` |
| Referee V5 | `apply-command` → `TEAM_A/B_WON_RALLY` | `match_live_states` + `match_events` | Every rally in V5 workspace |

**Risk:** Two authorities for live score on same sub-match → divergent totals, race on confirm/finalize.

**TT-5E requirement:** When `team_sub_match_referee_links.integration_status = 'live'`, **block** `saveSubMatchDraft` and draft RPC (return `score_entry_locked_v5_linked`).

---

## P0 — Dual finalization paths

| Path | Trigger | Outcome |
|------|---------|---------|
| `confirmSubMatchResult` / `team_tournament_confirm_sub_match` | Referee confirms in team portal | `sub_matches.status=completed`, `result_confirmed_at`, partial matchup `result` |
| V5 `finalize` edge action | Referee finalizes in V5 UI | `match_result_revisions` + `match_integration_outbox` rows |

**Risk:** Double finalize → duplicate standings movement, duplicate audit.

**TT-5D requirement:** TT sub-match summary updated **only** from outbox consumer after V5 finalize; legacy confirm **blocked** when link exists.

---

## P1 — Standings recalculation (three paths)

| Path | Mechanism |
|------|-----------|
| Client compute | `computeTeamStandings` + `team_tournament_upsert_standings` |
| Server TT-4 | `team_tournament_recompute_standings_cache` (forfeit/withdraw) |
| Confirm sub-match | Updates matchup partial result; **does not always** refresh standings cache |

**Recommendation:** After V5 integration, standings refresh triggered **only** by:

1. Outbox consumer `STANDINGS_RECALC_REQUESTED` (post-finalize)
2. TT-4 forfeit/withdraw (unchanged until TT-5F)

---

## P1 — Rally / scoring rule duplication

| Module | Location |
|--------|----------|
| TT rally hints | `src/features/team-tournament/engines/rallyScoringEngine.js` |
| V5 rally engine | `src/features/referee-v5/engines/rallyScoringEngine.js` |
| TT validate in referee engine | `teamRefereeEngine.validateSubMatchScoreInput` |
| V5 validate | `matchValidation.js`, scoring engines |

**Risk:** Rule drift between portals for same discipline format.

**TT-5B:** Define canonical rule source per sub-match format; V5 authoritative for live; TT summary stores final games/score only.

---

## P1 — Realtime vs polling

| System | Sync |
|--------|------|
| Team Tournament page | `useTeamTournamentPage` polling |
| Referee V5 | `useRefereeRealtimeSync` on `match_live_states` |

No duplication of logic, but **inconsistent UX** if team portal shows stale sub-match score while V5 live state advances.

**TT-5E:** Team portal sub-match row for linked matches reads summary from bridge + optional subscribe to standings/matchup aggregate only.

---

## P2 — Forfeit / technical result

TT-4 `team_tournament_apply_forfeit` writes directly to `sub_matches` (status `forfeit`).

V5 supports `DECLARE_FORFEIT` command.

**TT-5F scope decision:** Until unified, TT-4 forfeit remains TT-authoritative; V5-linked sub-matches should block TT forfeit if V5 state exists (or route forfeit through V5 command + same outbox).

---

## P2 — Dreambreaker / MLP

Only in Team Tournament (`dreambreakerEngine.js`, `RefereeDreambreakerPanel`). **No V5 equivalent.**

**Verdict:** OUT OF TT-5 V5 scope — legacy portal retains dreambreaker UI.

---

## Summary table

| Concern | Severity | TT-5 phase to resolve |
|---------|----------|----------------------|
| Dual live scoring | P0 | TT-5E |
| Dual finalize | P0 | TT-5D |
| Triple standings paths | P1 | TT-5D |
| Scoring rule drift | P1 | TT-5B |
| Forfeit dual path | P2 | TT-5F |
| Dreambreaker | P2 | TT-5F (out of scope) |
