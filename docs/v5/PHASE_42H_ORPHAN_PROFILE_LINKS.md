# Phase 42H — Orphan profile.club_id / membership SoT

**SQL:** [`PHASE_42H_ORPHAN_PROFILE_LINKS.sql`](./PHASE_42H_ORPHAN_PROFILE_LINKS.sql)

## 1. Production data (2026-07-10)

### Huỳnh Văn Anh (`4cf24ed0-99f8-4997-b803-3c7ff8e32014`)

| Field | Value |
|-------|-------|
| email | huynhanh1970@gmail.com |
| role | PLAYER |
| status | active |
| club_id | **null** (already cleared by Phase 42E; controlled UPDATE no-op) |
| player_id | **null** |
| venue_id | venue-prod-main |
| tenant_members | 0 |
| Active V2 membership | `club-219e4a7cbd73437eb6271f02a53314c3` (CLB ACCC) — owner + president |

Legacy id `clb-accc-1783635462598` is **not** in `public.clubs`. If UI still shows it, source is **local session / athlete-club-link / local registry**, not `profiles.club_id`.

### Verify SELECT (post clear)

```sql
select id, email, role, status, club_id, player_id, venue_id, updated_at
from public.profiles
where id = '4cf24ed0-99f8-4997-b803-3c7ff8e32014';
```

## 2. Orphan audit (Production)

| Check | Count |
|-------|------:|
| `profiles.club_id` orphan (missing clubs) | 0 |
| `profiles` with non-null `club_id` | 0 |
| `profiles` with non-null `player_id` | 0 |
| Active gov without active member | 0 |
| `club_members` → missing club | 0 |
| `clubs` / active members / active gov | 1 / 1 / 2 (new ACCC, consistent) |

## 3. Client rules (V2)

- `hasClub` ← `club_get_my_active_membership` / active `club_members` only
- Do **not** use `profiles.club_id` or `profiles.player_id` as membership SoT
- Role PLAYER/CLUB_MANAGER alone ≠ membership
- No active membership → hide “Rời CLB”; if `club.create` → show “Tạo CLB mới”
- Auth session on V2: strip legacy `clubId`/`playerId` + clear athlete link store

## 4. RPC

- `club_get_my_active_membership()`
- `club_leave_membership` → ends gov + member left + `phase42_clear_profile_club_links` + audit

## 5. Schema plan — `profiles.club_id`

| Option | Recommendation |
|--------|----------------|
| **A. Deprecate then drop** (preferred for Cloud SSOT) | Keep column nullable; stop all writes; after 1–2 releases drop `club_id`/`player_id` |
| **B. Keep + FK** | `club_id text references clubs(id) on delete set null` — only if product still needs denormalized hint |

**Decision for Phase 42H:** Option A path — no FK yet (clubs id text + soft delete); clear orphans; client ignores column; document drop in Phase 43+.

## 6. Rollback

```sql
-- Restore leave RPC from Phase 42C backup if needed (redeploy prior migration).
-- Profile clears are safe (null); cannot restore orphan values without backup dump.
```

Client: set `VITE_CLUB_STORAGE_V2=false` and redeploy previous build.
