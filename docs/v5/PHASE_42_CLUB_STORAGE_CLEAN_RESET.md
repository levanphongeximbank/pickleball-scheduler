# Phase 42 — Club Storage Clean Reset (Cloud SSOT)

**Status:** Staging Phase 42A–42E executed under Owner `GO STAGING RESET` (2026-07-10).  
**Production:** untouched.  
**Client V2 / Production reset:** still blocked until separate GO strings.

See also:
- [`PHASE_42_BACKUP_2026-07-10_STAGING.md`](./PHASE_42_BACKUP_2026-07-10_STAGING.md)
- [`PHASE_42B_SCHEMA.sql`](./PHASE_42B_SCHEMA.sql)
- [`PHASE_42C_RLS_RPC.sql`](./PHASE_42C_RLS_RPC.sql)
- [`PHASE_42E_RESET.sql`](./PHASE_42E_RESET.sql)

**Hard stop after this document:** Wait for Owner to send exactly:

```text
GO STAGING RESET
```

*(Received and executed for Staging. Next gates: `GO CLIENT V2`, then `GO PRODUCTION RESET`.)*

Do not Build for the purpose of reset, do not truncate, do not apply Production DDL until the matching GO gate below.

---

## 0. Architecture principles (mandatory)

1. Supabase PostgreSQL is the Single Source of Truth.
2. LocalStorage is only for UI preferences and non-authoritative cache.
3. IndexedDB is only for offline mutation queue.
4. No silent fallback from cloud failure to local authoritative write.
5. No background full-object push of club registry/blob.
6. `profiles.club_id` is **not** membership source of truth.
7. User–club relationship lives in `club_members`.
8. Governance lives in `club_governance_assignments`.
9. Every business table has `tenant_id`.
10. Important mutations go through RPC only.
11. Every mutation RPC must check: auth, tenant membership, permission, version, idempotency, audit.
12. Client accepts and uses the canonical row returned by the server.
13. Do not use `updated_at` as last-write-wins.
14. Conflicts use `version` / `base_version` / `expected_version`.
15. `null` must not clear existing data unless an explicit clear command is used.

**Platform Super Admin** must never automatically become club member, club owner, or president.

### Role vocabulary

| Role | Scope | Notes |
|------|-------|-------|
| `platform_super_admin` | Platform | Not a club member by default |
| `tenant_owner` | Tenant | Venue/org owner |
| `club_owner` | Club governance | Via `club_governance_assignments` |
| `president` | Club governance | Via `club_governance_assignments` |
| `vice_president` | Club governance | Via `club_governance_assignments` |

---

## 1. Tables / objects to KEEP

| Group | Object | Rule |
|-------|--------|------|
| Auth | `auth.users`, Auth schema | Never delete accounts |
| Identity skeleton | `profiles` | Keep rows; clear business club fields on reset |
| RBAC catalog | `roles`, `permissions`, `role_permissions` | Keep |
| Tenant skeleton | `venues` (and `tenants` view if present) | Keep project; seed/reseed root tenant only under GO |
| Billing (out of scope unless Owner expands) | `plans`, `plan_limits`, `tenant_subscriptions`, `invoices`, `invoice_items`, `payments`, `billing_events`, `billing_audit_logs`, `subscriptions` | Do not truncate by default |
| Platform infra | `api_clients`, `api_keys`, `api_logs`, `webhook_endpoints`, `webhook_events`, `tenant_integration_settings` | Keep |
| Migration history | Supabase migration records | Keep |
| Hosting / env | Vercel project, env vars | Keep |

**Accounts to keep:** all current `auth.users` including Super Admin login.

---

## 2. Tables / data allowed to DELETE (trial business data)

### 2.1 Cloud tables (truncate / later replace schema)

| Current table | Proposed action |
|---------------|-----------------|
| `club_governance` | TRUNCATE; replace with `clubs` + `club_governance_assignments` |
| `club_data_v3` | TRUNCATE; deprecate as SoT |
| `club_ai_data` | TRUNCATE |
| `club_membership_requests` | TRUNCATE; recreate under new contract |
| `court_clusters`, `user_cluster_assignments`, `court_claim_requests` | TRUNCATE (trial) |
| `court_engine_stores`, `court_engine_active_sessions` | TRUNCATE |
| `team_tournaments` + all `team_tournament_*` | TRUNCATE in FK order |
| `tournament_match_live`, `tournament_certifications` | TRUNCATE |
| `checkins`, `qr_tokens`, `push_subscriptions`, `notifications`, `notification_logs` | TRUNCATE if pilot |
| `pick_vn_player_ratings`, `vpr_*` | TRUNCATE trial data |
| `marketplace_orders`, `marketplace_products` | TRUNCATE if pilot |
| `payment_events`, `payment_transactions` | TRUNCATE if pilot (not billing core) |
| `audit_logs`, `integration_audit_logs`, `team_tournament_audit_logs`, `vpr_audit_logs` | TRUNCATE trial |
| `ai_suggestions`, `ai_workflow_checklists` | TRUNCATE |
| `_phase19b_test_accounts` | TRUNCATE/DROP if test-only |

### 2.2 `profiles` (no user delete)

```sql
-- PLANNED ONLY — do not run until GO
UPDATE public.profiles
SET club_id = NULL,
    player_id = NULL
WHERE true;
```

### 2.3 LocalStorage / IndexedDB (client schema bump)

Wipe business keys on `pickleball-storage-schema-version < 42` (see §8). No merge from old LocalStorage.

### 2.4 Production row-count snapshot (readonly audit, 2026-07-10)

| Table | Rows |
|-------|------|
| `club_governance` | 1 |
| `club_data_v3` | 1 |
| `club_membership_requests` | 0 |
| `club_ai_data` | 0 |
| `venues` | 1 |
| `profiles` | 18 |
| `auth.users` | 18 |
| `audit_logs` | 138 |
| `court_clusters` | 1 |
| `team_tournaments` | 7 |

Re-run counts on **Staging** in Phase 42A before any truncate.

---

## 3. Dependency order when deleting (Staging first)

Child → parent to avoid FK failures:

1. `team_tournament_sub_matches` → `team_tournament_matchups` → `team_tournament_lineup_entries` → `team_tournament_lineups` → `team_tournament_standings` → `team_tournament_team_members` → `team_tournament_teams` → `team_tournament_disciplines` → `team_tournament_audit_logs` → `team_tournaments`
2. `tournament_match_live`, `tournament_certifications`
3. `checkins` → `qr_tokens`
4. `notification_logs` → `notifications` → `push_subscriptions`
5. `club_membership_requests`
6. `club_data_v3`, `club_ai_data`
7. `club_governance`
8. `user_cluster_assignments` → `court_claim_requests` → `court_clusters`
9. `court_engine_active_sessions` → `court_engine_stores`
10. `vpr_point_ledger` → `vpr_leaderboard` → `vpr_athlete_links` → `vpr_athletes` → `pick_vn_player_ratings` → `vpr_audit_logs` (consider keeping `vpr_point_config`)
11. `marketplace_orders` → `marketplace_products`
12. Trial `audit_logs`, `ai_suggestions`, `ai_workflow_checklists`
13. `profiles`: clear `club_id` / `player_id`
14. **Never** truncate `auth.users`; **never** drop billing core unless separate Owner GO
15. After new schema: seed root tenant/venue + `tenant_members` for operators (platform role stays out of `club_members`)

---

## 4. New schema (Phase A)

### Decision (default)

In Phase A, **`tenant_id` = `venues.id`** (current app rule `tenantId === venueId`).

Physical `tenants` table may be introduced on Staging as a controlled promote/rename; until then FK targets `venues(id)`.

### 4.1 `tenants` (target physical table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | Prefer stable ids like `venue-prod-main` |
| `name` | `text` | |
| `slug` | `text` | unique |
| `status` | `text` | |
| `timezone` | `text` | |
| `version` | `int not null default 1` | |
| `created_at` / `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz null` | soft delete |

### 4.2 `tenant_members`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `tenant_id` | `text not null` | FK venue/tenant |
| `user_id` | `uuid not null` | FK `auth.users` |
| `role_code` | `text not null` | `tenant_owner`, `tenant_staff`, … |
| `status` | `text not null` | `active` / `inactive` |
| `version` | `int not null default 1` | |
| `created_at` / `updated_at` | `timestamptz` | |

Unique active pair: (`tenant_id`, `user_id`).

### 4.3 `clubs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | |
| `tenant_id` | `text not null` | |
| `name` / `code` / `description` | text | |
| `status` | `text` | `pending_setup`, `pending_approval`, `active`, `inactive` |
| `registered_cluster_id` | `text null` | |
| `version` | `int not null default 1` | |
| `created_by_user_id` | `uuid null` | |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | |

### 4.4 `club_members` (minimum)

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `tenant_id` | `text not null` |
| `club_id` | `text not null` → `clubs(id)` |
| `user_id` | `uuid not null` |
| `athlete_id` | `uuid null` → `athletes(id)` |
| `membership_type` | `text` |
| `status` | `text` (`active`, `left`, `removed`) |
| `joined_at` / `left_at` | timestamptz |
| `version` | `int not null default 1` |
| `created_at` / `updated_at` | timestamptz |

Unique active: (`club_id`, `user_id`) where `status = 'active'`.

### 4.5 `club_governance_assignments` (minimum)

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `tenant_id` | `text not null` |
| `club_id` | `text not null` |
| `club_member_id` | `uuid not null` → `club_members(id)` |
| `role_code` | `text not null` (`club_owner`, `president`, `vice_president`) |
| `status` | `text` (`active`, `ended`) |
| `effective_from` / `effective_to` | timestamptz |
| `version` | `int not null default 1` |
| `created_at` / `updated_at` | timestamptz |

Constraints:

- At most one active `club_owner` per club
- At most one active `president` per club
- Cap active `vice_president` count (product constant, e.g. 2)

### 4.6 `club_membership_requests`

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `tenant_id` / `club_id` / `user_id` | required |
| `message` | `text` |
| `status` | `pending` / `approved` / `rejected` / `cancelled` |
| `reviewed_by` / `reviewed_at` / `review_note` | nullable |
| `version` | `int not null default 1` |
| `created_at` / `updated_at` | timestamptz |

Unique pending per (`club_id`, `user_id`).

### 4.7 `athletes`

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `tenant_id` | `text not null` |
| `display_name` / `phone` | text |
| `user_id` | `uuid null` |
| `status` / `version` / timestamps | |

### 4.8 `audit_logs`

Reuse existing table or extend with: `tenant_id`, `request_id`, `action`, `resource_type`, `resource_id`, `actor_user_id`, `before`, `after`, `created_at`.

### 4.9 `idempotency_requests`

| Column | Type |
|--------|------|
| `request_id` | `uuid` PK (or unique with actor) |
| `tenant_id` | `text` |
| `actor_user_id` | `uuid` |
| `rpc_name` | `text` |
| `request_hash` | `text` |
| `response_json` | `jsonb` |
| `created_at` | `timestamptz` |

Unique (`actor_user_id`, `request_id`).

### Indexes / triggers (42B)

- Indexes on (`tenant_id`), (`club_id`), (`user_id`), (`status`), (`version`)
- `updated_at` trigger (metadata only — not LWW)
- Version increment only inside RPC on successful mutation

---

## 5. RPC contracts (minimum)

Every mutation accepts at least:

- `p_request_id uuid`
- `p_expected_version int` (or `p_base_version`)
- tenant + permission checks
- idempotency lookup/store
- audit write
- canonical JSON response: `{ ok, code?, error?, data, version }`

| RPC | Purpose |
|-----|---------|
| `club_create` | Create club + (non-SA) creator as active `club_members` + `club_owner` (+ `president` by default). Single txn; never writes `profiles.club_id`; never changes platform role. See Phase 42G. |
| `club_get` | Detail + display labels |
| `club_list_registry` | Admin/tenant registry |
| `club_list_discoverable` | Discoverable clubs |
| `club_list_members` | Members + derived governance roles |
| `club_submit_membership_request` | Join request |
| `club_list_my_requests` | Caller’s requests |
| `club_list_pending_requests` | Pending for club officers |
| `club_cancel_membership_request` | Cancel own pending |
| `club_review_membership_request` | Approve/reject → create `club_members` |
| `club_assign_owner` | Assign owner |
| `club_clear_owner` | **Explicit** clear owner |
| `club_transfer_president` | Transfer president |
| `club_assign_vice_president` | Assign VP |
| `club_remove_vice_president` | Remove VP |
| `club_leave_membership` | Leave club |

Conflict code: `VERSION_CONFLICT` when `expected_version <> row.version`.

Null payload fields must **not** clear owner/VP; only `club_clear_owner` / `club_remove_vice_president` clear.

---

## 6. RLS matrix

| Table | Super Admin | Tenant owner/staff | Club owner / president / VP | Member | Anon |
|-------|-------------|--------------------|-----------------------------|--------|------|
| `clubs` SELECT | all | same tenant | same tenant/club | discoverable active | no |
| `clubs` WRITE | RPC only | RPC only | RPC only | no | no |
| `club_members` | all | tenant read | club manage via RPC | self read | no |
| `club_governance_assignments` | all | tenant read | manage via RPC | club read | no |
| `club_membership_requests` | all | limited | review club | own rows | no |
| `athletes` | all | tenant | club-linked | self | no |
| `idempotency_requests` | no direct client write | no | no | via RPC only | no |
| `tenant_members` | all | tenant manage via RPC | read limited | no | no |

**Policy:** no direct client `INSERT`/`UPDATE`/`DELETE` on these business tables; `SELECT` under RLS; writes only through `SECURITY DEFINER` RPCs.

---

## 7. Seed plan after reset

1. Keep `auth.users` + `profiles` (club fields cleared).
2. Ensure root venue/tenant id (e.g. `venue-prod-main`). Truncating `venues` requires explicit Owner note in GO.
3. Seed `tenant_members` for operators as needed; Super Admin remains platform role, **not** auto club member.
4. Do **not** recreate CLB ACCC automatically; Owner recreates via `club_create` / UI after client V2.
5. Optional Staging-only fixture club for QA (never auto-promote to Production).

---

## 8. LocalStorage cleanup plan

On app boot, set/read:

```text
pickleball-storage-schema-version = 42
```

If stored version `< 42`, **delete** (no migrate):

- `pickleball-clubs-v1`, `pickleball-active-club-v1`
- `pickleball-club-data-v3::*`, `pickleball-club-cloud-version-v1::*`, `pickleball-club-sync-meta-v1::*`
- `pickleball-club-extension-v1::*`, `pickleball-athlete-club-link-v1`
- `pickleball-cloud-db-v1`
- AI / director / waiting / history business keys
- `pickleball-offline-queue-v1` (+ meta/lock)
- Trial cluster assignment/claim business keys in scope

**Keep:** minimal auth session cache needed to restore Supabase session, UI theme/locale preferences if present.

**IndexedDB:** clear offline mutation queue stores on schema bump.

---

## 9. QA matrix (Phase 42G)

| Case | Expected |
|------|----------|
| Athlete + `club.create` tạo CLB | Active member + `club_owner` (+ president default); platform role unchanged |
| Reload / browser khác | Cùng owner từ cloud |
| Retry cùng `request_id` | Idempotent; không duplicate club |
| Lỗi giữa chừng create | Rollback toàn bộ (không orphan club) |
| Owner CLB A vs CLB B | Không cross-club admin |
| Two browsers, two users, same tenant | Same clubs / members / requests |
| Other-tenant user | No cross-tenant read/write |
| Submit join → approve | Active `club_members`; governance unchanged unless intended |
| Assign owner / clear owner | Owner cleared only via `club_clear_owner` |
| Transfer president | Version bump; concurrent stale → `VERSION_CONFLICT` |
| Schema 42 cache reset | Business LS wiped |
| Super Admin | Not auto member/owner/president |
| Build / lint / unit | Pass before Production GO |

---

## 10. Backup and rollback plan

Before any Staging/Production reset:

1. Supabase project backup / `pg_dump` for in-scope tables.
2. Export CSV at minimum: `club_governance`, `club_data_v3`, `profiles(id,email,role,club_id,player_id)`, `venues`.
3. Record row counts + timestamp in `docs/v5/PHASE_42_BACKUP_<date>.md`.
4. Rollback: restore dump; set `VITE_CLUB_STORAGE_V2=false`; redeploy previous client if required.
5. Never force-push git history; never delete Auth users for rollback.

---

## 11. Code files expected to change

### Docs / SQL (created after GO gates)

- `docs/v5/PHASE_42_CLUB_STORAGE_CLEAN_RESET.md` ← **this file**
- `docs/v5/PHASE_42B_SCHEMA.sql`
- `docs/v5/PHASE_42C_RLS_RPC.sql`
- `docs/v5/PHASE_42E_RESET.sql`
- `docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql` / `PHASE_42G_CLUB_CREATE_OWNER.md`

### Client — club domain

- `src/features/club/services/clubRegistryCloudSync.js` (remove blind push)
- `src/features/club/services/clubRegistryCloudService.js`
- `src/features/club/services/clubRegistryRpcService.js`
- `src/features/club/services/clubGovernanceService.js`
- `src/features/club/services/clubTenantService.js`
- `src/features/club/services/clubMembershipRequestService.js`
- `src/features/club/services/clubMembershipRequestRpcService.js`
- `src/features/club/services/clubMemberService.js`
- `src/features/club/storage/clubExtensionStorage.js` (deprecate as SoT)
- `src/features/club/storage/athleteClubLinkStore.js` (deprecate as SoT)
- `src/pages/player/MyClubPage.jsx`, `src/pages/player/myClub/*`
- `src/pages/clubs/*`

### Sync / storage

- `src/ai/cloudSync.js`, `src/ai/clubCloudPush.js`, `src/ai/autoCloudSync.js`, `src/ai/cloudSyncConfig.js`
- `src/domain/clubStorage.js`, `src/domain/clubSyncMetadata.js`
- `src/context/ClubContext.jsx`
- `src/auth/authService.js`

### Flags

- `src/features/club/config/clubRegistryFlags.js`
- Env: `VITE_CLUB_STORAGE_V2`

---

## 12. Planned commands / SQL — NOT EXECUTED YET

```bash
# ONLY after: GO STAGING RESET
# 1) Backup Staging
# 2) Apply docs/v5/PHASE_42B_SCHEMA.sql on Staging
# 3) Apply docs/v5/PHASE_42C_RLS_RPC.sql on Staging
# 4) Run docs/v5/PHASE_42E_RESET.sql (TRUNCATE in dependency order)
# 5) Seed tenant_members / root venue as planned
# 6) Local: npm run build && npm test
# 7) Deploy Preview only — Production requires separate GO
```

```sql
-- EXAMPLE ONLY — DO NOT RUN TODAY
-- BEGIN;
-- -- TRUNCATE ... in §3 order
-- UPDATE public.profiles SET club_id = NULL, player_id = NULL;
-- COMMIT;
```

### Current background sync / dual-write inventory (to disable in 42E/42F)

| Entry | File |
|-------|------|
| `syncClubRegistryForUser` (pull + push) | `src/features/club/services/clubRegistryCloudSync.js` |
| `scheduleClubCloudPush` | `src/ai/clubCloudPush.js` via `saveClubData` |
| `autoPullOnClubActivate` / `autoSyncAfterScheduleCommit` | `src/ai/autoCloudSync.js` |
| `persistClubToCloud` / `syncClubsForVenueToCloud` | `src/features/club/services/clubRegistryCloudService.js` |
| Login registry sync | `src/auth/authService.js` |
| ClubContext registry sync | `src/context/ClubContext.jsx` |

Direct club blob REST write: `src/ai/cloudSync.js` → `club_data_v3`.

---

## 13. Owner GO gates (hard stops)

| Gate | Exact confirmation string | Allowed work |
|------|---------------------------|--------------|
| **DOC** | *(completed by writing this file)* | Documentation only |
| **STAGING RESET** | `GO STAGING RESET` | 42A audit + 42B schema + 42C RLS/RPC + 42D verify + 42E staging truncate/seed |
| **CLIENT V2** | `GO CLIENT V2` | 42F client cloud-first + LS schema bump |
| **PRODUCTION RESET** | `GO PRODUCTION RESET` | Prod backup + reset + migrate + deploy |

### Phase sequence

| Phase | Name | Prerequisite |
|-------|------|--------------|
| 42A | Audit before delete | `GO STAGING RESET` |
| 42B | New schema on Staging | after 42A |
| 42C | RLS + RPC | after 42B |
| 42D | Staging verification | after 42C |
| 42E | Controlled reset + seed | after 42D pass |
| 42F | Client refactor | `GO CLIENT V2` |
| 42G | Production QA | `GO PRODUCTION RESET` (separate) |

---

## STOP

This document is complete.

**Next Owner action:** review this file, then reply with exactly:

```text
GO STAGING RESET
```

Until that message arrives: no DELETE/TRUNCATE, no Staging/Production DDL apply for reset, no Production deploy for Phase 42.
