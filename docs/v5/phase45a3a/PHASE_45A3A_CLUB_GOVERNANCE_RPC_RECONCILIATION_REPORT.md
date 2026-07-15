# Phase 45A.3A — Club Governance RPC DDL Reconciliation Report

**Type:** Repository reconciliation (record-only). No Production/Staging change.
**Date:** 2026-07-15
**Branch:** `integration/phase45a3a-club-governance-ddl-reconciliation` (from `origin/main` `f3ab3d1`)
**Companion SQL:** `PHASE_45A3A_CLUB_GOVERNANCE_RPC_RECONCILIATION.sql`

## 1. Scope

Recover and commit the **exact deployed DDL** for three Club governance RPCs whose
`CREATE FUNCTION` text was missing from the repository:

- `public.club_assign_owner(uuid, text, uuid, integer)`
- `public.club_clear_owner(uuid, text, integer)`
- `public.club_transfer_president(uuid, text, uuid, integer)`

Out of scope (not authored/committed here): any Club command cutover, new Club
update/archive/VP RPCs, SQL execution, migration, feature-flag or deployment change.

## 2. Evidence source

A single **read-only** catalog introspection was run against **Production**
(`expuvcohlcjzvrrauvud`) on 2026-07-15, under explicit authorization, using two
independent authoritative sources that agree:

| Source | What it gave |
|--------|--------------|
| `pg_get_functiondef(p.oid)` on `pg_proc` | Live currently-deployed function bodies (verbatim, used in the SQL file) |
| `supabase_migrations.schema_migrations.statements` where `name='phase_42c_membership_and_governance_rpcs'` (version `20260710035123`) | Original authored migration SQL, incl. `grant execute … to authenticated` |

Deployment confirmed via read-only `list_migrations`:

- Production: migration `phase_42c_membership_and_governance_rpcs` version `20260710035123` — present
- Staging: same migration version `20260710034003` — present

No mutating statement was executed. No RPC was called. No data was modified.

## 3. Confidence per function

| RPC | Confidence | Basis |
|-----|-----------|-------|
| `club_assign_owner` | **EXACT** | Live `pg_get_functiondef` + original migration statement (identical) |
| `club_clear_owner` | **EXACT** | Live `pg_get_functiondef` + original migration statement (identical) |
| `club_transfer_president` | **EXACT** | Live `pg_get_functiondef` + original migration statement (identical) |

## 4. Production signature / metadata comparison

| RPC | Deployed identity args | Return | Security | Volatility | Owner | Client wrapper args (clubStorageV2RpcService.js) | Match |
|-----|------------------------|--------|----------|-----------|-------|--------------------------------------------------|-------|
| `club_assign_owner` | `p_request_id uuid, p_club_id text, p_member_user_id uuid, p_expected_club_version integer` | `json` | DEFINER | volatile | postgres | `p_request_id, p_club_id, p_member_user_id, p_expected_club_version` | ✅ |
| `club_clear_owner` | `p_request_id uuid, p_club_id text, p_expected_club_version integer` | `json` | DEFINER | volatile | postgres | `p_request_id, p_club_id, p_expected_club_version` | ✅ |
| `club_transfer_president` | `p_request_id uuid, p_club_id text, p_next_user_id uuid, p_expected_club_version integer` | `json` | DEFINER | volatile | postgres | `p_request_id, p_club_id, p_next_user_id, p_expected_club_version` | ✅ |

All three set `search_path = public` and are `LANGUAGE plpgsql`, `SECURITY DEFINER`.

### Live EXECUTE grants (pg_proc.proacl, Production)

```
{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

The original migration explicitly granted EXECUTE only to `authenticated` (reproduced
in the SQL file). The additional `PUBLIC` / `anon` / `service_role` EXECUTE come from
standard Supabase environment default privileges on schema `public`, not from an
RPC-specific grant. This is documented in the SQL header; the reconciliation file
reproduces the authored grant and does not attempt to re-grant environment defaults.

## 5. Behavior contract (verified against evidence)

All three follow the Phase 42 canonical envelope and idempotency/versioning model:

- **Auth:** `auth.uid()` required → else `NOT_AUTHENTICATED`.
- **Idempotency:** `p_request_id` (uuid) required → else `REQUEST_ID_REQUIRED`;
  replay served from `phase42_idempotency_get/put` (per-function operation key).
- **Optimistic concurrency:** `p_expected_club_version` compared to `clubs.version`
  → mismatch returns `VERSION_CONFLICT`.
- **Success envelope:** `{ ok:true, data: phase42_club_canonical(club_id), version: clubs.version+1 }`.
- **Version bump:** `update public.clubs set version = version + 1` on success
  (corroborated by STAGING QA `AUDIT.json`: assign 11→12, transfer 13→14).

| RPC | Authorization | Target check | Assignment effect | Audit action |
|-----|---------------|--------------|-------------------|--------------|
| `club_assign_owner` | platform super admin **or** tenant member | member must be `active` in club → else `MEMBER_REQUIRED` | end active `club_owner`, insert new `club_owner` active | `club.assign_owner` |
| `club_clear_owner` | platform super admin **or** tenant member | — | end active `club_owner` (no new insert) | `club.clear_owner` |
| `club_transfer_president` | platform super admin **or** `phase42_has_gov_role(club_owner|president)` **or** tenant member | next user must be `active` member → else `MEMBER_REQUIRED` | end active `president`, insert new `president` active | `club.transfer_president` |

## 6. Error / audit / version / idempotency contract

| Server condition (SQL) | Envelope `code` | Client-mapped API error |
|------------------------|-----------------|--------------------------|
| `auth.uid()` null | `NOT_AUTHENTICATED` | FORBIDDEN (client treats unauthenticated as blocked) |
| missing `p_request_id` | `REQUEST_ID_REQUIRED` | INTERNAL_ERROR / validation |
| club not found / soft-deleted | `NOT_FOUND` | NOT_FOUND |
| `p_expected_club_version` mismatch | `VERSION_CONFLICT` | CONFLICT |
| caller not authorized | `FORBIDDEN` | FORBIDDEN |
| target not an active member | `MEMBER_REQUIRED` | CONFLICT / NOT_FOUND |
| overload not resolvable (PostgREST) | `PGRST202` | RPC_NOT_DEPLOYED |

Server canonical audit actions exactly match the whitelist in
`docs/v5/PHASE_42KA_GOVERNANCE_AUDIT_PATCH.sql`:
`club.assign_owner`, `club.clear_owner`, `club.transfer_president`.

## 7. Unresolved differences

None affecting the function contract. The only non-body difference is the EXECUTE
grant surface (§4): the deployed ACL includes Supabase default `PUBLIC/anon/service_role`
EXECUTE beyond the migration's explicit `authenticated` grant. This is environmental,
documented, and not a discrepancy in the reconciled DDL.

## 8. Effect if the SQL is run

**Record-only.** Every statement is `CREATE OR REPLACE FUNCTION` with the identical
currently-deployed body plus an idempotent `grant execute … to authenticated`.

- On **Production**: behavior-neutral no-op (same signature, same body, grant already present).
- On a **clean rebuild / DR / staging**: recreates the three functions exactly as deployed.

The file contains **no** DROP, ALTER, INSERT, UPDATE, DELETE, or new RPCs.

## 9. Prerequisites (already deployed; not redefined here)

Tables `public.clubs`, `public.club_members`, `public.club_governance_assignments`,
`public.audit_logs`; helpers `phase42_err`, `phase42_idempotency_get/put`,
`phase42_write_audit`, `phase42_club_canonical`, `phase42_is_platform_super_admin`,
`phase42_is_tenant_member`, `phase42_has_gov_role`
(from `phase_42b_*`, `phase_42c_helpers_and_rls`, `phase_42g_permissions_constraint_helpers`).

## 10. Note on prior Production diagnostic

`docs/v5/qa-evidence/phase42k-production/DIAGNOSTIC.json` recorded these RPCs as
`exists:false` (`PGRST202`). That probe called them with only `(p_club_id, p_request_id)`
— a partial argument set PostgREST cannot resolve — so it is a **probe artifact, not
absence**. The migration history and `pg_get_functiondef` confirm the functions are
deployed in Production.
