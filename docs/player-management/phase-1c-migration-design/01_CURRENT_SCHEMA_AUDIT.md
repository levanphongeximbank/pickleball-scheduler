# 01 — Current Schema Audit

## Tables audited

| Table | Role |
|-------|------|
| `auth.users` | Login identity |
| `public.profiles` | Account + hybrid demographics |
| `public.athletes` | Cloud person alias (Phase 42) |
| `public.club_members` | Membership edge |
| `public.club_data_v3` | JSON blob incl. `players[]` |
| Venue `customers` (blob/model) | Venue CRM — not player SSOT |
| `pick_vn_player_ratings` / rating V5 / CC-02 | Rating refs |
| `vpr_athletes` / `vpr_athlete_links` | Ranking refs |

Primary SQL sources: `docs/supabase-rbac.sql`, identity sprint1/B/C, `PHASE_31_PICK_VN_ONBOARDING_PROFILE.sql`, `PHASE_42B_SCHEMA.sql`, `PHASE_42C_RLS_RPC.sql`, V5.2 RBAC roles SQL.

---

## `profiles` (cumulative documented)

| Column | Notes |
|--------|--------|
| `id` uuid PK → `auth.users` | Account key |
| `email`, `display_name`, `phone`, `avatar_url` | Account UX |
| `role`, `venue_id`, `club_id`, `status` | RBAC / tenancy / account lifecycle |
| `player_id` text | Alias to canonical player id |
| `gender` text, `birth_year` int | Demographics (Phase 31) |
| `must_change_password`, `tournament_id`, `team_id` | Auth/ops |

**Missing Phase 1C:** `birth_date`, `handedness`, `activity_region`, `privacy_settings`, identity verification.

**FKs out:** `auth.users`, `venues`.  
**Indexes:** venue_id, club_id.  
**Triggers:** `handle_new_user`, `profiles_guard_privileged_update`, `profiles_sync_user_roles` (role sync).

### RLS (summary)

| Policy | Op |
|--------|-----|
| `profiles_self_select` | SELECT self / super admin |
| `profiles_venue_staff_select` | SELECT same venue staff |
| `profiles_self_update` | UPDATE self |
| `profiles_venue_owner_insert` | INSERT invite |
| `profiles_venue_owner_update` | UPDATE venue owner / super admin |

---

## `athletes` / `club_members`

- Athletes: `display_name`, `phone`, `user_id`, `status` — **no demographics**.  
- Club members: membership edge only.  
- Writes via SECURITY DEFINER RPCs; direct mutate revoked.

## Rating / ranking

Separate ID spaces; must not store Player foundation demographics.
