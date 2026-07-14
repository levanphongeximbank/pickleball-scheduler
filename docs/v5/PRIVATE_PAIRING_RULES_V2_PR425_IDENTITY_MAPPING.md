# PR-4.25 — Identity Mapping Policy

## ID field definitions (must stay distinct)

| Field | Meaning | Used for |
|-------|---------|----------|
| `tenant_id` / `venue_id` | Tenancy | Rule Set tenant, club ownership |
| `club_id` | Club registry id (`public.clubs.id`) | CLUB scope, member list, source club |
| `profile_id` / `auth_user_id` | `profiles.id` = `auth.users.id` | Account / membership user |
| `player_id` | Domain athlete id | Private Pairing `primary_player_id` / `target_player_ids` |

**Forbidden:** storing tenant/venue into `club_id`; storing profile/auth id into `primary_player_id`.

## Canonical player ID policy

Priority:

1. **MAPPED** — `profiles.player_id` present and accepted.
2. **DERIVED** — no `profiles.player_id`, but `player-auth-{authUserId}` convention confirmed **and** player row exists in the directory (blob/directory callback).
3. **UNMAPPED** — active membership without resolvable player id.
4. **INVALID** — `profiles.player_id` points to a missing player when `requirePlayerRow=true`.

Cloud-only clubs (empty `club_data_v3`): `profiles.player_id` is trusted as MAPPED without requiring a blob player row (synthetic directory hit). Members without `player_id` remain UNMAPPED — **no silent create**.

## Warning codes

| Code | Meaning |
|------|---------|
| `UNMAPPED_ACTIVE_MEMBER` | Active member not selectable for rules |
| `INVALID_PLAYER_MAPPING` | Broken `profiles.player_id` |
| `DUPLICATE_MEMBERSHIP_HISTORY` | History rows collapsed to one logical membership |
| `PLAYER_OUTSIDE_CLUB` | Player club mismatch |
| `PLAYER_OUTSIDE_TENANT` | Club/tenant mismatch |
| `PLAYER_MAPPING_REQUIRED` | Save blocked — need mapped playerId |

## Membership dedupe

Per `user_id`, keep one logical row: prefer `active`, then status rank, then newest timestamp, then stable id. Left/removed/rejected/pending are excluded from default picker lists.

## Bridge notes audited before implementation

| Bridge | Role |
|--------|------|
| `profiles.player_id` | Preferred explicit map (`profileService`) |
| `player-auth-{userId}` | Established auth-link convention (`platformAthleteService`, membership request) |
| `club_members.user_id` | Membership SSOT user key |
| `club_members.athlete_id` | Cloud athlete UUID (Phase 42B) — **not** used as Private Pairing player_id in PR-4.25 |
| Blob `players[].authUserId` | Legacy blob link only |

## Mapping gaps (ACCC-style)

Typical Production club with empty blob:

- Active members with `profiles.player_id` → selectable.
- Active members without → visible in mapping summary / warnings, not selectable.
- Requires backfill (see BACKFILL_PLAN) before 100% picker coverage.
