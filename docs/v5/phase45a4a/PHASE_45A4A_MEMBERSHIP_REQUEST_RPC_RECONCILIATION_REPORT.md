# Phase 45A.4A — Membership Request RPC DDL Reconciliation Report

**Type:** Repository reconciliation (record-only). No Production/Staging change.
**Date:** 2026-07-15
**Branch:** `integration/phase45a4a-membership-request-rpc-ddl` (from `origin/main` `26d9398`)
**Companion SQL:** `PHASE_45A4A_MEMBERSHIP_REQUEST_RPC_RECONCILIATION.sql`

## 1. Scope

Recover and commit the **exact deployed DDL** for three Membership Request RPCs
whose `CREATE FUNCTION` text was missing from the repository:

- `public.club_submit_membership_request(uuid, text, text)`
- `public.club_cancel_membership_request(uuid, uuid, integer)`
- `public.club_list_my_requests()`

Out of scope (not authored/committed here): review / list-pending / leave,
add/remove member, role/status/restore, governance RPCs, archive/delete,
Membership command cutover, SQL execution, migration apply, feature-flag or
deployment change.

## 2. Evidence source

Read-only catalog introspection against **Production** (`expuvcohlcjzvrrauvud`)
and **Staging** (`qyewbxjsiiyufanzcjcq`) on 2026-07-15:

| Source | What it gave |
|--------|--------------|
| `pg_get_functiondef(p.oid)` on `pg_proc` (Prod + Staging) | Live currently-deployed function bodies (verbatim, used in the SQL file); Prod ≡ Staging |
| `pg_get_function_identity_arguments` + volatility / `prosecdef` | Signature + SECURITY DEFINER + volatile metadata |
| `supabase_migrations.schema_migrations.statements` where `name='phase_42c_membership_and_governance_rpcs'` (Prod version `20260710035123`) | Original authored migration SQL, incl. `grant execute … to authenticated` |
| `pg_proc` ACL via `aclexplode` | Live EXECUTE grantees |

No mutating statement was executed. No RPC was called. No data was modified.

## 3. Confidence per function

| RPC | Confidence | Basis |
|-----|-----------|-------|
| `club_submit_membership_request` | **EXACT** | Prod `pg_get_functiondef` ≡ Staging ≡ phase_42c body (cosmetic form only) |
| `club_cancel_membership_request` | **EXACT** | Prod `pg_get_functiondef` ≡ Staging ≡ phase_42c body (cosmetic form only) |
| `club_list_my_requests` | **EXACT** | Prod `pg_get_functiondef` ≡ Staging ≡ phase_42c body (cosmetic form only) |

Cosmetic-only migration vs catalog differences (not contract-affecting):

- Authoring used `int`; catalog / `pg_get_functiondef` reports `integer`.
- Authoring used `p_message text default ''`; catalog shows `DEFAULT ''::text`.
- Authoring used `$$` delimiters / lowercase keywords; catalog uses `$function$` and expanded `SECURITY DEFINER` / `SET search_path TO 'public'`.

## 4. Production signature / metadata comparison

| RPC | Deployed identity args | Return | Security | Volatility | Client wrapper args (`clubStorageV2RpcService.js`) | Match |
|-----|------------------------|--------|----------|-----------|-----------------------------------------------------|-------|
| `club_submit_membership_request` | `p_request_id uuid, p_club_id text, p_message text` | `json` | DEFINER | volatile | `p_request_id, p_club_id, p_message` | ✅ |
| `club_cancel_membership_request` | `p_request_id uuid, p_membership_request_id uuid, p_expected_version integer` | `json` | DEFINER | volatile | `p_request_id, p_membership_request_id, p_expected_version` | ✅ |
| `club_list_my_requests` | *(none)* | `json` | DEFINER | volatile | `{}` | ✅ |

All three set `search_path = public` and are `LANGUAGE plpgsql`, `SECURITY DEFINER`.
Production has a **single** `club_submit_membership_request` overload (V2 uuid/text/text); the Phase 31 `(text, text, numeric)` overload is absent.

### Live EXECUTE grants (pg_proc.proacl, Production)

```
{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

The original migration explicitly granted EXECUTE only to `authenticated` (reproduced
in the SQL file). Additional `PUBLIC` / `anon` / `service_role` EXECUTE come from
standard Supabase environment default privileges on schema `public`.

## 5. Compare: deployed / migration / repository

| Artifact | Status for the three RPCs |
|----------|---------------------------|
| Production catalog | Present; bodies recovered |
| Staging catalog | Present; bodies identical to Production |
| Migration `phase_42c_membership_and_governance_rpcs` | Present on both envs; authored CREATE + grant match contract |
| Git repository (pre-45A.4A) | **Missing** CREATE bodies (class-B gap from 45A.4.0 audit). Client wrappers already match identity args. Legacy Phase 31 SQL in `docs/v5/PHASE_31_CLUB_MEMBERSHIP_REQUESTS.sql` documents a **different** overload and is not the live V2 contract. |

## 6. Behavior contract (verified against evidence)

| RPC | Auth | Idempotency | Version | Effect | Audit |
|-----|------|-------------|---------|--------|-------|
| `club_submit_membership_request` | `auth.uid()` required; platform SA → `FORBIDDEN` | `p_request_id` + `phase42_idempotency_get/put` | initial `version=1` on insert | insert pending row into `club_membership_requests_v42`; `unique_violation` → `PENDING_EXISTS`; active member → `ALREADY_MEMBER`; missing/inactive club → `NOT_FOUND` | `club.membership_request.submit` |
| `club_cancel_membership_request` | caller must own the request | `p_request_id` + idempotency | `p_expected_version` vs row → `VERSION_CONFLICT` | pending → `cancelled`, bump request version | *(none)* |
| `club_list_my_requests` | `auth.uid()` required | *(none)* | *(none)* | returns all of caller's rows ordered by `created_at desc` | *(none)* |

### Error tokens present in reconciled bodies

`NOT_AUTHENTICATED`, `REQUEST_ID_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `ALREADY_MEMBER`, `PENDING_EXISTS`, `INVALID_STATUS`, `VERSION_CONFLICT`.

Success envelopes:

- submit: `{ ok:true, data:{ id, club_id, status:'pending' }, version:1 }`
- cancel: `{ ok:true, data:{ id, status:'cancelled' }, version: previous+1 }`
- list: `{ ok:true, data: jsonb_array }`

## 7. Unresolved differences

None affecting the function contract. Grant surface includes environmental
`PUBLIC/anon/service_role` EXECUTE beyond the migration's explicit `authenticated`
grant (same pattern as Phase 45A.3A). Documented; not reproduced beyond the
authored grant.

## 8. Effect if the SQL is run

**Record-only.** Every statement is `CREATE OR REPLACE FUNCTION` with the identical
currently-deployed body plus an idempotent `grant execute … to authenticated`.

- On **Production**: behavior-neutral no-op (same signature, same body, grant already present).
- On a **clean rebuild / DR / staging**: recreates the three functions exactly as deployed.

The file contains **no** DROP, ALTER, INSERT, UPDATE, DELETE, or new RPCs.

## 9. Prerequisites (already deployed; not redefined here)

Tables `public.clubs`, `public.club_membership_requests_v42`, `public.club_members`,
`public.audit_logs`; helpers `phase42_err`, `phase42_idempotency_get/put`,
`phase42_write_audit`, `phase42_is_platform_super_admin`,
`phase42_active_club_member_id`.

## 10. Next phase (not started)

Phase 45A.4B and any Membership command cutover remain **out of scope** for this
record-only reconciliation.
