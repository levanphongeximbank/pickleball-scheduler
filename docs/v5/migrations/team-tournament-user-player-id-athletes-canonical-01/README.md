# team-tournament-user-player-id-athletes-canonical-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging or Production without Owner GO.**

## Why

Hard-cutover identity audit after `team-tournament-dashboard-draft-operational-role-visibility-01`:

| Path | Authority |
|------|-----------|
| `team_tournament_get_dashboard` primary | `athletes.id` via `athletes.user_id = auth.uid()` |
| Dashboard fallback | `team_tournament_user_player_id()` |
| Live helper body (Staging fingerprint `c168c14f87ad03a2a246150cd47afcf3`) | **legacy** `profiles.player_id` |

So Dashboard still has a **legacy player_id fallback** when no athlete row exists.

## Target contract

`team_tournament_user_player_id()` becomes canonical:

```
athletes.id
where athletes.user_id = auth.uid()
order by updated_at desc nulls last, created_at desc nulls last
limit 1
```

Empty string when no athlete row — **never** `profiles.player_id`.

Shared Team Tournament callers of the helper then inherit athletes-canonical identity without retargeting already-applied Dashboard APPLY in place.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` restores legacy `profiles.player_id` helper body.

## Safety

- No Staging/Production apply in the Dashboard tenant-authority client turn
- No fixture mutation
- Does not change gender resolver (`athletes → profiles(user_id)`)
- Does not reapply draft-visibility package
