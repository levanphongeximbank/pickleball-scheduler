# TT-5C — Result Propagation

**Production impact:** NONE

---

## Flow

```
Referee V5 finalize
  → match_result_revisions (official)
  → match_integration_outbox (STANDINGS_RECALC_REQUESTED)
  → team_tournament_consume_referee_v5_outbox (service_role)
  → team_tournament_apply_referee_v5_result (atomic)
  → sub-match update
  → team_tournament_recompute_matchup_result
  → team_tournament_recompute_standings_cache
  → bridge status finalized + last_result_revision_id
  → audit team.referee_v5.result_applied
  → inbox row + outbox completed
```

---

## Mapping (V5 → TT)

| V5 | TT |
|----|-----|
| `final_score.teamA/B` | `score.teamA/B` |
| `winner_team_id` | `winner_team_id` (must ∈ {teamA, teamB}) |
| `finalized_at` | `result_confirmed_at` |
| revision id | `bridge.last_result_revision_id` |
| status cancelled/void | sub-match `waiting`, score cleared |

Source tag: `referee_v5`

---

## Revision replacement

Newer revision replaces older official result deterministically (full sub-match write, not incremental delta). Stale revisions rejected. Reopened clears finalized state.

---

## Legacy lock

Unchanged from TT-5B: linked/finalized sub-matches block legacy draft/confirm server-side and in portal.

Consumer failure sets bridge `sync_error`; **no fallback to legacy**.

---

## Reprovision

Lineup version drift → effective `reprovision_required` in `refereeLinkOps` / `scoreOps`.  
`team_tournament_resync_referee_link` refreshes snapshot when allowed.
