# V5-P1C.3 — Wave A Player Link Plan

**Gate:** P1-C.3 — PLAYER LINK preparation only  
**Generated at:** `2026-07-14T00:18:29.544Z`  
**Mode:** plan-only (read Production; **no write**)  
**Production ref:** `expuvcohlcjzvrrauvud`  
**Pilot club:** `club-219e4a7cbd73437eb6271f02a53314c3`  
**Source CSV:** `docs/v5/rating-v5/V5-P1C_WAVE_A_CANDIDATE_INPUT.csv`  
**Evidence JSON:** `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-18-29-545Z/PLAYER_LINK_PLAN.json`

## Safety snapshot (read-only)

| Check | Value |
|-------|-------|
| `allow_v5_assessment` | `false` |
| Active enrollments | **0** |
| Profiles updated this gate | **NONE** |
| Enroll executed | **NO** |
| Production changed | **NO** |

## Skill band precondition

**PASS — 5/5** (`1.5-2.5` / `3.0-3.5` allowlist, ASCII hyphen)

## Per-user Production read + proposed link

Formula: `proposed_player_id = player-auth-<auth.users.id>`  
(`buildPlayerIdForAuthUser`; applied only when `profiles.player_id IS NULL`)

| Slot | Email | auth.users.id | profiles.id | current `profiles.player_id` | proposed `player_id` | Club | Dup guard |
|------|-------|---------------|-------------|------------------------------|----------------------|------|-----------|
| WA-01 | tudotaichinhtuoi29@gmail.com | `c13392ab-fc7e-483a-9b31-ba08d94a69a9` | `c13392ab-fc7e-483a-9b31-ba08d94a69a9` | `null` | `player-auth-c13392ab-fc7e-483a-9b31-ba08d94a69a9` | active | none |
| WA-02 | hoangmanhluong2405@gmail.com | `6e77321e-1182-4174-a08a-3ee2d1833c7c` | `6e77321e-1182-4174-a08a-3ee2d1833c7c` | `null` | `player-auth-6e77321e-1182-4174-a08a-3ee2d1833c7c` | active | none |
| WA-03 | lephong.banker@gmail.com | `42c8ad99-3afd-4122-bf36-de1f6f9a302f` | `42c8ad99-3afd-4122-bf36-de1f6f9a302f` | `null` | `player-auth-42c8ad99-3afd-4122-bf36-de1f6f9a302f` | active | none |
| WA-04 | gionam76@gmail.com | `6ff822c6-c1b6-4ce0-9e20-61f7afc74a88` | `6ff822c6-c1b6-4ce0-9e20-61f7afc74a88` | `null` | `player-auth-6ff822c6-c1b6-4ce0-9e20-61f7afc74a88` | active | none |
| WA-05 | huonganna120193@gmail.com | `f776d627-a9f2-4c0c-8d81-bda239cc923b` | `f776d627-a9f2-4c0c-8d81-bda239cc923b` | `null` | `player-auth-f776d627-a9f2-4c0c-8d81-bda239cc923b` | active | none |

Notes:

- For all 5: `auth.users.id === profiles.id` (expected for this app).
- Profile status: `active` for all 5.
- Duplicate check: no other profile currently owns any of the 5 proposed `player_id` values.

## Planned SQL shape (not executed)

Idempotent per row:

```sql
UPDATE public.profiles
SET player_id = '<proposed_player_id>',
    updated_at = now()
WHERE id = '<profiles_id>'
  AND player_id IS NULL;
```

Guard before each update:

```sql
SELECT id, email FROM public.profiles
WHERE player_id = '<proposed_player_id>'
  AND id <> '<profiles_id>';
-- must return 0 rows
```

Apply path (future gate only):

```bash
PRODUCTION_P1C_PLAYER_LINK_GO=YES node scripts/prepare-v5p1c-wave-a-player-links.mjs --apply
```

## Explicit non-actions (this gate)

- No `--apply`
- No `UPDATE profiles`
- No enroll into `rating_v5_pilot_enrollments`
- No change to `allow_v5_assessment` / feature flags
- No Edge deploy / frontend deploy

## Residual notes (not blockers for link apply)

- `club_data_v3` for pilot club may still be empty — roster blob sync is a separate owner step if required by enrollment UI.
- Enroll remains blocked until separate owner GO after links are applied and re-verified.

---

## Final report

```text
PLAYER LINK PLAN: READY
READY TO APPLY PLAYER LINKS: YES
READY TO ENROLL: NO
PRODUCTION CHANGED: NO
```
