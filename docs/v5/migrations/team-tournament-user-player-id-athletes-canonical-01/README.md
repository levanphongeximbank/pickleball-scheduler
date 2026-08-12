# team-tournament-user-player-id-athletes-canonical-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging or Production without Owner GO.**

## Why

Hard-cutover identity audit after Dashboard draft-visibility + My Tournaments discoverability:

| Path | Authority |
|------|-----------|
| `team_tournament_get_dashboard` primary | `athletes.id` via `athletes.user_id = auth.uid()` |
| Dashboard fallback + captain/setup/lineup helpers | `team_tournament_user_player_id()` |
| Live helper body (Staging fingerprint `c168c14f87ad03a2a246150cd47afcf3`) | **legacy** `profiles.player_id` |

Staging seed proof that legacy is unsafe:

- M01–M04: `profiles.player_id` happens to equal `athletes.id` (coincidence)
- M05–M08 / F01–F08: `profiles.player_id` is alias (`qa-tt412-seed-*`) ≠ `athletes.id`

## Target contract

`team_tournament_user_player_id()` becomes canonical:

```
athletes.id
where athletes.user_id = auth.uid()
order by updated_at desc nulls last, created_at desc nulls last
limit 1
```

Empty string when no athlete row — **never** `profiles.player_id`.

Shared Team Tournament callers of the helper then inherit athletes-canonical identity.

## Live callers (Staging)

Direct:

1. `team_tournament_assert_captain_portal_access`
2. `team_tournament_guard_captain_portal_write` (Save Draft / Submit / Dreambreaker order)
3. `team_tournament_get_dashboard` (fallback after athletes primary)
4. `team_tournament_get_setup`
5. `team_tournament_get_visible_lineups`
6. `team_tournament_is_matchup_participant` (realtime participant gate)

Indirect via guard/assert: `get_captain_portal`, `save_lineup_draft`, `submit_lineup`, `submit_dreambreaker_order`, legacy draft save.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql` (definition + M01/M04/M05 + fail-closed + Dashboard/Portal/guard + referee non-dependency)

Rollback: `04_ROLLBACK.sql` restores exact prior helper fingerprint `c168c14f87ad03a2a246150cd47afcf3`.

## Safety

- No Staging/Production apply without Owner GO
- No fixture mutation
- Does not change gender resolver (`athletes → profiles(user_id)`)
- Does not reapply draft-visibility or list-my-dashboards packages
