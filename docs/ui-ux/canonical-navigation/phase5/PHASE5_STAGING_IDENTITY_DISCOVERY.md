# Phase 5 Staging Identity Discovery (Read-Only)

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Staging identity discovery for PLATFORM_ADMIN + COACH  
**Mode:** Read-only discovery — **no create, invite, role update, env change, deploy, commit, PR**  
**Generated:** 2026-08-06  
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\ui-ux\canonical-navigation-phase5`  
**Branch:** `feature/canonical-navigation-phase5-preview-acceptance`  
**HEAD:** `087c61c7d8bb1efdae343685269e53aa75767e21`

Machine-readable twin: [`PHASE5_STAGING_IDENTITY_DISCOVERY.json`](./PHASE5_STAGING_IDENTITY_DISCOVERY.json)

Owner-confirmed Vercel state (input, not changed by this task):

| Field | Value |
|-------|-------|
| Project | `pickleball-scheduler` |
| Variable | `VITE_CANONICAL_APP_SHELL_ENABLED` |
| Value | `true` |
| Environment | Preview |
| Branch | `feature/canonical-navigation-phase5-preview-acceptance` |
| Production changed | **NO** |
| Production redeployed | **NO** |

---

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE5_STAGING_IDENTITY_DISCOVERY_READY_FOR_OWNER_EXECUTION_DECISION`**

Staging project identity is proven. Canonical role authority for **PLATFORM_ADMIN** is clear via the documented **SUPER_ADMIN ↔ PLATFORM_ADMIN** alias (no schema change). **COACH** cannot be assigned as `profiles.role` without expanding `profiles_role_check` (schema/constraint change) and inserting the missing `roles` catalog row — Owner must approve a Staging schema GO **or** waive the COACH identity for Phase 5.

Discovery did **not** create users or mutate data.

---

## 0. Project / environment proof

| Check | Result |
|-------|--------|
| Expected Staging ref | `qyewbxjsiiyufanzcjcq` |
| Connected MCP | `user-supabase-pickvn-staging-readonly` |
| DB session user | `supabase_read_only_user` |
| Access mode | **Read-only** |
| Staging fingerprint | `public.venues` = `venue-staging-a`, `venue-staging-b` |
| Production queried with write access | **NO** |
| Write MCP used | **NO** |

Conclusion: connected environment is **Staging**, not Production.

---

## 1. Canonical PICK_VN sources

| Concern | Canonical source | Notes |
|---------|------------------|-------|
| Auth users | `auth.users` (+ `auth.identities`) | Supabase Auth SoT; 88 users on Staging |
| User profiles | `public.profiles` | `profiles.id = auth.users.id`; app maps via `src/auth/profileService.js` |
| Role catalog | `public.roles` | 12 system roles present |
| Role assignment (primary app authz) | **`public.profiles.role`** | Client `normalizeRole(row.role)` drives AuthContext |
| Role assignment (mirror) | `public.user_roles` | Synced from profile by trigger `sync_user_roles_from_profile` |
| Permissions catalog | `public.permissions` | 144 rows |
| Role↔permission grants | `public.role_permissions` | 436 rows |
| Tenant membership | `public.tenant_members` (+ `profiles.venue_id` / `club_id`) | Secondary; venue scope commonly on profile |
| PLATFORM_ADMIN authorization | App canonical `PLATFORM_ADMIN`; DB legacy **`SUPER_ADMIN`** | `LEGACY_ROLE_ALIASES[SUPER_ADMIN]=PLATFORM_ADMIN`; `denormalizeRoleForDb(PLATFORM_ADMIN)=SUPER_ADMIN` |
| COACH authorization | App canonical `COACH` in `roles.js` + client matrix | **DB catalog row missing**; cannot store on `profiles.role` under current check |

Signup path: trigger `handle_new_user` always inserts profile as **`PLAYER`** (metadata role ignored). Promote requires privileged update after signup.

Admin UI / RPC: `identity_admin_update_user` exists (Phase C) — docs note it locks/unlocks and does **not** freely elevate roles as the primary promote path. Historical Staging QA promote path = Owner SQL `UPDATE public.profiles SET role = …` after signup.

---

## 2. Do roles exist canonically?

| Role | App (`CANONICAL_ROLES`) | `public.roles` | `profiles_role_check` allows | Existing `profiles.role` rows |
|------|:----------------------:|:--------------:|:----------------------------:|:-----------------------------:|
| PLATFORM_ADMIN | **YES** | **YES** (catalog id) | **NO** (literal string) | **0** literal; **SUPER_ADMIN** used instead |
| SUPER_ADMIN (DB alias) | Alias → PLATFORM_ADMIN | **YES** | **YES** | **YES** (n=3 active) |
| COACH | **YES** | **NO** | **NO** | **0** |

`profiles_role_check` currently allows only:

`SUPER_ADMIN`, `VENUE_OWNER`, `VENUE_MANAGER`, `COURT_OWNER`, `COURT_MANAGER`, `CASHIER`, `ACCOUNTANT`, `REFEREE`, `CLUB_OWNER`, `PLAYER`

---

## 3. Exact role-assignment method (current)

**Primary mechanism: direct `profiles.role` column** (not invitation-as-SoT, not user_roles-as-SoT for app shell).

Flow:

1. Create Auth user (signup / Auth admin) → `handle_new_user` → `profiles.role='PLAYER'`.  
2. Owner/service promote: `UPDATE profiles SET role=<allowed>, venue_id=…, status='active'`.  
3. Trigger `sync_user_roles_from_profile` mirrors into `user_roles` (FK requires `role_id` ∈ `roles`).  
4. App login reads profile → `normalizeRole` → RBAC matrix.

Supporting objects: `public.roles`, `public.role_permissions`, `user_roles`, optional `tenant_members`, Identity RPCs for list/update (not the Staging QA promote SoT).

---

## 4. Existing Staging test identities (redacted)

| Target | Existing? | Evidence (no emails published) |
|--------|:---------:|--------------------------------|
| PLATFORM_ADMIN (app-effective) | **YES** | `profiles.role='SUPER_ADMIN'` count **3** (active); Staging-local SUPER_ADMIN count **2**; `user_roles` SUPER_ADMIN primary rows present |
| PLATFORM_ADMIN (literal DB string) | **NO** | 0 profiles / 0 user_roles with `PLATFORM_ADMIN` |
| COACH | **NO** | 0 profiles, 0 user_roles, 0 roles catalog row |

Emails redacted per objective. Do not publish credentials.

---

## 5. What creating each identity requires

### PLATFORM_ADMIN (safe path without schema change)

| Step | Required? |
|------|:---------:|
| Supabase Auth user creation | YES if new dedicated account; **NO** if reuse existing SUPER_ADMIN |
| Invitation acceptance | NO (signup or Auth admin create) |
| Profile insertion | Automatic via `handle_new_user` |
| Tenant membership | NO for global admin (`venue_id` null typical) |
| Role assignment | YES → set `profiles.role='SUPER_ADMIN'` (maps to PLATFORM_ADMIN in app) |
| Permission seed | NO (SUPER_ADMIN already has broad `role_permissions`) |
| Enrollment | NO |
| Manual password setup | YES for new Auth user (operator vault only) |

**Literal `profiles.role='PLATFORM_ADMIN'`:** blocked by check constraint → would require schema change → **not** recommended for Phase 5.

### COACH (blocked without schema/catalog expansion)

| Step | Required? |
|------|:---------:|
| Supabase Auth user creation | YES |
| Invitation acceptance | NO |
| Profile insertion | Automatic as PLAYER |
| Tenant membership | YES recommended (`venue_id` at minimum; COACH is venue-scoped in app) |
| Role assignment to `COACH` | **Blocked** until `profiles_role_check` includes `COACH` **and** `roles` has `COACH` |
| Permission seed | Optional/partial — coaching permissions exist; `role_permissions` for COACH only apply if role row exists (COACHING-04 seed is conditional) |
| Enrollment / coaching assignment | Not required for Phase 5 nav denial cells |
| Manual password setup | YES |

---

## 6. Minimum safe Staging mutation packages (proposed only — not executed)

### Package A — PLATFORM_ADMIN (recommended: reuse)

| # | Target | Action | Record | Previous | Proposed | Rollback | Owner interaction |
|---|--------|--------|--------|----------|----------|----------|-------------------|
| A0 | — | None | Existing SUPER_ADMIN Staging test identity | Already PLATFORM_ADMIN-effective | Unchanged | N/A | Confirm reuse for OD-B03 PLATFORM_ADMIN cells |

**Mutations:** 0  
**Schema/migrations:** NO  
**Credentials exposure risk:** NO (use existing vaulted Staging password)

### Package B — PLATFORM_ADMIN (new dedicated Staging user)

| # | Target | Action | Record | Previous | Proposed | Rollback | Owner interaction |
|---|--------|--------|--------|----------|----------|----------|-------------------|
| B1 | Supabase Auth | Create user (Dashboard Auth or app signup) | `auth.users` | absent | active user `@staging.local` | Delete Auth user | YES — Owner creates; password to vault only |
| B2 | `public.profiles` | Auto via trigger | profile | PLAYER | PLAYER | Cascade with Auth delete | None |
| B3 | `public.profiles` | Privileged UPDATE role | profile.role | PLAYER | **SUPER_ADMIN** | UPDATE back to PLAYER or delete user | YES — Owner SQL/console (agent SQL=NO) |
| B4 | `public.user_roles` | Trigger sync | mirror row | none/PLAYER | SUPER_ADMIN primary | Trigger on rollback | Automatic |

**Do not** set role string `PLATFORM_ADMIN` (fails check).  
**Schema/migrations:** NO  
**Never** put password in Git/PR/screenshots.

### Package C — COACH (requires Owner Staging schema GO)

| # | Target | Action | Record | Previous | Proposed | Rollback | Owner interaction |
|---|--------|--------|--------|----------|----------|----------|-------------------|
| C1 | `public.profiles` constraint | `ALTER` `profiles_role_check` add `'COACH'` | check constraint | no COACH | allows COACH | Restore prior check DDL | **YES — schema GO** |
| C2 | `public.roles` | INSERT | role id COACH | absent | present | DELETE role row | YES |
| C3 | `public.role_permissions` | Optional seed (COACHING-04 assigned.* if desired) | grants | 0 | ≥0 | DELETE grants | YES |
| C4 | Auth + profile | Create + promote | user/profile | absent / PLAYER | COACH + venue_id | Delete user / demote | YES |
| C5 | `user_roles` | Trigger sync | mirror | — | COACH | Automatic | — |

**Schema changes required:** **YES** (C1)  
**Migrations required:** **YES** if Owner insists on tracked DDL (recommended)  
Until C1+C2 approved: **do not attempt COACH provision**.

### Package D — Waive COACH (Phase 5 nav only)

| # | Action | Notes |
|---|--------|-------|
| D0 | Mark COACH Preview cells as Owner-waived | Use VENUE_MANAGER / PLAYER for unrelated-role denial; document LIMITED |

**Mutations:** 0 · **Schema:** NO

---

## 7. STOP conditions evaluation

| Condition | Triggered? |
|-----------|:----------:|
| Staging not proven | **NO** |
| Canonical role authority ambiguous | **NO** for PLATFORM_ADMIN (alias clear); COACH app-clear but DB incomplete |
| Schema changes required for full dual package | **YES for COACH** — Owner decision required |
| Migrations required for COACH literal | **YES if proceeding with Package C** |
| Production write access detected | **NO** |
| Only creation method exposes credentials | **NO** (signup + vault; reuse path exists for PLATFORM_ADMIN) |

Overall discovery remains **READY_FOR_OWNER_EXECUTION_DECISION** (not discovery-BLOCKED): Owner must choose Packages A/B + C or D.

---

## Owner decision prompts

1. **PLATFORM_ADMIN:** Reuse existing SUPER_ADMIN Staging identity (**A**) **or** create new SUPER_ADMIN-labeled Staging user (**B**)?  
2. **COACH:** Approve Staging schema GO for Package **C**, **or** waive with Package **D**?  
3. Confirm agent remains **SQL=NO** / no Auth mutations until Owner executes.

---

## Safety attestation

| Check | Value |
|-------|------:|
| Auth mutations performed | **0** |
| Database mutations performed | **0** |
| SQL writes | **0** |
| Read-only SELECT discovery queries | Performed (Staging readonly MCP) |
| Production mutations | **0** |
| Env / deploy / commit / push / PR | **NO** |
| Credentials exposed | **NO** |
| Schema applied | **NO** |
| Migrations applied | **NO** |
