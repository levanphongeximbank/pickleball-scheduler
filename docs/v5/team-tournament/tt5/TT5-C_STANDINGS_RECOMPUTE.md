# TT-5C — Standings Recompute

**Production impact:** NONE

---

## Single canonical path

After V5 result apply, consumer calls **only**:

1. `team_tournament_recompute_matchup_result(matchup_id)`
2. `team_tournament_recompute_standings_cache(team_tournament_id)`

Same functions as TT-4 forfeit/withdraw tail. Compatible with TT-4 standings schema (played, wins, losses, sub-match diff, forfeit count, rank).

---

## Do not use for V5-linked results

- Client `refreshStandings()` / `team_tournament_upsert_standings`
- Legacy `confirm_sub_match` path when bridge active
- Incremental standings delta from consumer

---

## Helper

`team_tournament_referee_v5_recompute_after_result(team_tournament_id, matchup_id)` — service_role wrapper documenting the contract (used internally / future worker).

---

## Exactly-once

Standings rebuild is idempotent: replayed outbox events do not re-apply sub-match or re-run consumer apply path when inbox/revision guards hit.
