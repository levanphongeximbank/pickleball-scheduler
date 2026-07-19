# Club Phase 2C — `club_roster_assignments` Design

**Status:** DESIGN APPROVED for Phase 2C gate (ship optional — implementation in **Phase 2E**)  
**Date:** 2026-07-19  
**Authority:** Club Phase 2B Domain Freeze §3.6–3.7 + API Freeze §8  
**Workstream:** WS-A / Phase 2C  
**SQL ship in 2C:** **No** (design only)

---

## 1. Purpose

Separate **Captain / Coach** roster titles from base `club_members` membership.  
Membership remains the join spine (`active | left | removed`).  
Captain/Coach are assignment rows that **require** an active membership.

Cardinality (Owner locked):

| Role | Cardinality | Primary |
|------|-------------|---------|
| Captain | **0..N** | Optional `is_primary` (at most one when set) |
| Coach | **0..N** | No primary |

Committee: **excluded** (post–Phase 2).

---

## 2. Proposed table

```sql
-- DESIGN ONLY — do not apply in Phase 2C
create table if not exists public.club_roster_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  club_id uuid not null references public.clubs(id),
  user_id uuid not null references auth.users(id),
  role_code text not null check (role_code in ('captain', 'coach')),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'cleared')),
  version integer not null default 1,
  assigned_by_user_id uuid null,
  assigned_at timestamptz not null default now(),
  cleared_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active primary captain per club
create unique index if not exists club_roster_one_primary_captain
  on public.club_roster_assignments (club_id)
  where role_code = 'captain' and is_primary = true and status = 'active';

-- One active assignment per (club, user, role)
create unique index if not exists club_roster_unique_active_role
  on public.club_roster_assignments (club_id, user_id, role_code)
  where status = 'active';
```

### RLS (2E)

- Select: club members / governance / tenant staff per visibility matrix  
- Writes: **RPC only** (SECURITY DEFINER) — no authenticated direct inserts/updates

---

## 3. Invariants

1. Assign Captain/Coach only if `club_members` row exists with `status = 'active'` for `(club_id, user_id)`.  
2. On membership `leave` / `remove`: clear all active roster assignments for that user (same txn or cascading RPC).  
3. VP **cannot** assign/clear Captain/Coach (Owner / President only).  
4. Local extension `members[].role = captain|coach` is **deprecated SoT**; read fallback only until 2E cutover.  
5. Competition may **read** `roster.listCaptains` / `listCoaches`; must not write.

---

## 4. Freeze APIs (implement in 2E)

| API | Notes |
|-----|-------|
| `roster.assignCaptain` / `clearCaptain` | Owner/President |
| `roster.setPrimaryCaptain` / `clearPrimaryCaptain` | Owner/President |
| `roster.listCaptains` | public read |
| `roster.assignCoach` / `clearCoach` | Owner/President |
| `roster.listCoaches` | public read |

Audit: `roster.captain_*`, `roster.coach_*` per API freeze.

---

## 5. Phase 2C exit criteria for this design

| Check | Status |
|-------|--------|
| Design document present | ✅ this file |
| Cardinality matches Owner lock | ✅ 0..N + optional primary |
| No SQL applied in 2C | ✅ |
| Ship deferred to 2E | ✅ |

**Gate result:** Roster design **GO** for Phase 2C (implementation deferred).
