# PR-4.25 — Player Mapping Backfill Plan

**Do not run on Production in PR-4.25.** Owner GO required.

## Goal

For each **active** `club_members` row lacking a usable domain `player_id`, establish a canonical mapping without inventing IDs ad hoc.

## Canonical player ID rules

1. If `profiles.player_id` already set and valid → keep (MAPPED).
2. Else preferred new id: `player-auth-{profiles.id}` (existing app convention).
3. Never set `player_id = profiles.id` (auth id ≠ domain player id).
4. Never set club scope fields from `tenant_id` / `venue_id`.

## Steps (staging first)

1. **Inventory**
   - Active members per club.
   - Join `profiles` for `player_id`.
   - Classify MAPPED / UNMAPPED / INVALID.
2. **Check player existence**
   - If platform has a `players` / athletes table used by Production V2, check by candidate id.
   - If only blob/`club_data_v3`, decide whether roster backfill is required for DERIVED.
3. **Create missing player rows** (only when approved)
   - Create with canonical id, display name from profile, club/tenant links as separate fields.
4. **Update `profiles.player_id`**
   - Set only when null or INVALID and repair approved.
5. **`club_members.athlete_id`**
   - If column used, align to cloud athlete UUID **after** athlete row exists; do not copy into Private Pairing player ids.
6. **Duplicate membership history**
   - Do not delete history without audit.
   - Prefer soft-close duplicate `active` rows; keep one active per `(club_id, user_id)`.
7. **Verification SQL** (illustrative)
   - Count active members.
   - Count profiles with non-null `player_id`.
   - Count members still UNMAPPED.
   - Spot-check ACCC club id if used.
8. **Rollback**
   - Keep snapshot of updated `profiles.player_id` and created player ids.
   - Null out only rows written by the batch; do not touch unrelated mappings.

## Verification checklist

- [ ] Staging inventory report attached
- [ ] No Production writes without GO
- [ ] Private Pairing picker mapping summary improves (mapped ↑, unmapped ↓)
- [ ] No profile id leaked into `primary_player_id`

## Out of scope for PR-4.25

- Running the backfill
- Populating `club_data_v3`
- Auto-create players from the app at runtime
