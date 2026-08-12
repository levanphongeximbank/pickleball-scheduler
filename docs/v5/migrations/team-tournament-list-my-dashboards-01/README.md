# team-tournament-list-my-dashboards-01

**LOCAL PACKAGE ONLY. Do NOT apply without Owner GO.**

## Why

Owner real-browser: Dashboard `/tournaments/:id` PASS for captains, but after login there is no UI path — only manually typed URLs.

`canonical_tournament_list_mine(p_tenant_id, p_club_id, p_player_id)` is structurally wrong for this contract:

| Gap | Detail |
|-----|--------|
| Client context | Requires tenant + club + player_id from browser |
| Draft ops | Excludes draft unless `can_manage` — misses captain/deputy/referee |
| Identity | Client-supplied `p_player_id`, not `auth.uid() → athletes.id` |

## Target authority

```text
team_tournament_list_my_dashboards()
```

- No client tenant/club/player args
- Identity: `auth.uid() → athletes.id` only (no `profiles.player_id`, no `team_tournament_user_player_id`)
- Tenant: server `user_venue_id()` (super_admin bypass) — same gate family as `team_tournament_assert_tenant`
- Visibility: **parity** with `team_tournament_can_view_dashboard` / `get_dashboard`

### Draft

| Role | Listed |
|------|--------|
| organizer (`can_manage`) | YES |
| captain / deputy | YES |
| assigned referee | YES |
| ordinary participant | NO |
| nonparticipant | NO |

### registration / ready / active / completed

Same-tenant authenticated viewers (Dashboard parity), with role accumulation.

### cancelled

Not athlete-visible — organizer only (Dashboard parity).

## Apply order

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` drops the new RPC only.

## Depends on (already on Staging)

- `team_tournament_can_view_dashboard` (draft operational-role package)
- `team_tournament_status_is_athlete_visible`
- `team_tournament_can_manage`
- `athletes.user_id`

## Locked SHA256 (LF)

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `468ca37aa7dc20fd5783f2ddcf829570c29b8cc394494c68a98ac1faa5bc240a` |
| `02_APPLY.sql` | `03d82a7b714171f7334a30944795b81146ca66b67a4f06777fe6d1fedbf527aa` |
| `03_VERIFY.sql` | `74141a654d0d941bd1e51c8830ec5f70393b9c08a82ed5f20e66f0de150e4430` |
| `04_ROLLBACK.sql` | `57a99d0894f9cecf3224842f9181c3de02569d1aa7c96321978e65bb1ee1afd5` |

## Safety

- No Staging/Production apply in the implementation turn
- Does not reapply Dashboard packages
- Does not modify `canonical_tournament_list_mine`
- Does not apply `team-tournament-user-player-id-athletes-canonical-01` (list does not need it)
