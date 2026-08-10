# Team Tournament Captain Access Control — Package 01

**Status:** LOCAL PACKAGE ONLY — **DO NOT APPLY** without separate Owner GO.  
**Workstream:** `TEAM-TOURNAMENT-PR412-CAPTAIN-ACCESS-W0-W1-IMPLEMENTATION-01`  
**Waves:** W0 (this package) + W1 (client). Staging SQL apply = W2 (Owner GO).

## Contract

`PUBLIC_PUBLISHED` ⊥ `CAPTAIN_ACCESS_ENABLED`

| State | Result |
|-------|--------|
| Draft/unpublished + `captainAccessEnabled=false` | Captain portal denied |
| Draft/unpublished + `captainAccessEnabled=true` | Assigned captain/deputy allowed (own team) |
| `PUBLIC_PUBLISHED=false` | Public/general schedule remains hidden |
| Public publish | Does **not** auto-open captain portal |

## Storage

`team_tournaments.settings.captainAccessEnabled` (boolean JSONB key)  
No new column. No RLS changes. Organizer `team_tournament_get_setup` unchanged.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback helpers: `04_ROLLBACK.sql` (partial — see file notes).

## APPLY contents

| Item | Name |
|------|------|
| Backfill | `captainAccessEnabled=true` where key absent |
| Helper | `team_tournament_captain_access_enabled` |
| Assert | `team_tournament_assert_captain_portal_access` |
| Write guard | `team_tournament_guard_captain_portal_write` |
| Setter | `team_tournament_set_captain_access` (manage-only) |
| Reader | `team_tournament_get_captain_portal` (scoped) |
| Gates | `save_lineup_draft_legacy`, `get_visible_lineups`, `submit_dreambreaker_order` |
| Grants | `authenticated` execute; `anon` revoked |

## Client defaults (W1)

- New tournaments: `captainAccessEnabled=false`
- Missing key on client: **not** invented as `true` (fail closed for portal gate)
- Compatibility for existing rows: this package backfill only (W2)

## Safety

- No Staging/Production apply from this workstream
- No public publication logic changes
- No localStorage authority
- Captain never gains organizer/admin role
