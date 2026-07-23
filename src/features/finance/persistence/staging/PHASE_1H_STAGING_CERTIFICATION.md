# Phase 1H — Staging SQL Apply and Adapter Certification

**Date/time (UTC):** 2026-07-23T11:37:51Z  
**Feature HEAD at apply:** `f879a1ac52178dc2c6a0f4333040362138274895`  
**Branch:** `feature/finance-phase-1-foundation`  
**Verdict class:** READY WITH CONDITIONS (see Unresolved conditions)

## Staging project identity

| Field | Value |
|-------|-------|
| Project reference | `qyewbxjsiiyufanzcjcq` |
| Project name | `pickleball-scheduler-stagin` |
| URL / host | `https://qyewbxjsiiyufanzcjcq.supabase.co` / `db.qyewbxjsiiyufanzcjcq.supabase.co` |
| Region | `ap-southeast-2` |
| Environment | **STAGING** |
| Production ref (blocked) | `expuvcohlcjzvrrauvud` (`pickleball-scheduler-production`) |

**How Staging was identified**

1. Repository SSOT docs pin Staging `qyewbxjsiiyufanzcjcq` vs Production `expuvcohlcjzvrrauvud`.
2. Management API `GET /v1/projects/qyewbxjsiiyufanzcjcq` returned matching ref + non-production name.
3. Apply scripts hard-refuse Production ref / Production URL.
4. Credentials loaded only from gitignored sibling `.env.staging-qa.local` (Management API token / Staging anon). No Production credential used.

**Explicit:** Production was not accessed for write. Production SQL was not applied.

## SQL checksums (unchanged)

| File | SHA-256 |
|------|---------|
| `docs/supabase-finance-phase1f.sql` | `0310905a5fba1ca2028d841c612f9cd7fcf22a5db96d7d9c4d81da3354050d00` |
| `docs/supabase-finance-phase1f-rollback.sql` | `b86921d7571c6861c0ec3a5464d87af7fd8f740000e55bfe6785535b8c40ea95` |

Forward SQL was applied **exactly as committed**. Historical SQL files were not modified.

## Apply method

Supabase Management API:

`POST https://api.supabase.com/v1/projects/qyewbxjsiiyufanzcjcq/database/query`

Script: `scripts/apply-finance-phase1h-staging-sql.mjs --apply`  
Scope: only `docs/supabase-finance-phase1f.sql` (no bulk migration push, no `db reset`, no rollback executed).

## Backup / rollback readiness

| Item | Result |
|------|--------|
| Backup API | Available (`/database/backups` HTTP 200) |
| `walg_enabled` | `true` |
| `pitr_enabled` | `false` |
| Listed backups count | `0` via API snapshot at apply time |
| Rollback SQL | Present; Finance-only; no CASCADE; destroys Finance staging data |
| Pre-apply Finance data | None (all 11 tables ABSENT) |
| Rollback executed? | **No** (not required; forward apply succeeded) |

Rollback trigger criteria: partial apply leaving inconsistent `finance_*` objects, or Owner-approved emergency recovery of this Staging apply. Approval: Owner Phase 1H authorization covers failed-apply recovery when rollback remains Finance-scoped and no pre-existing Finance operational data exists.

## Pre-apply dependency audit

| Dependency | Result |
|------------|--------|
| `public.user_venue_id()` | Present (`text`) |
| `public.is_super_admin()` | Present (`boolean`) |
| `public.user_has_permission(text)` | Present |
| `finance.view` / `finance.edit` permissions | Present in `public.permissions` |
| Intended `finance_*` tables | All **ABSENT** (safe initial apply) |
| Billing `public.invoices` / `public.payments` | Exist and were **not** altered |

## Applied object inventory

All 11 tables present after apply:

1. `finance_fee_definitions`
2. `finance_audit_evidence`
3. `finance_obligations`
4. `finance_invoices`
5. `finance_invoice_items`
6. `finance_payments`
7. `finance_payment_attempts`
8. `finance_receipts`
9. `finance_refunds`
10. `finance_events`
11. `finance_idempotency`

Compact inventory: `SCHEMA_INVENTORY_SUMMARY.json`  
Full verify dump: `APPLY_REPORT.json`

## Table / constraint / index / RLS verification

For every Finance table verified:

- Primary key on `id`
- `tenant_id` present
- RLS enabled + **FORCE ROW LEVEL SECURITY**
- Expected policies for authenticated (receipts/events: no UPDATE policy)
- Grants: `authenticated` least-privilege only; **0** anon/PUBLIC grants
- `amount_minor` where applicable: `bigint`
- Currency checks to `VND` where authored
- Version columns on mutable aggregates
- Unique indexes: idempotency `(tenant_id, operation_type, idempotency_key)`; provider txn; receipt per payment; attempt number; event id

## Tenant-isolation QA

Authenticated contexts: Staging Owner A (`venue-staging-a`) and Owner B (`venue-staging-b`).

| Check | Result |
|-------|--------|
| Anon/public select denied | PASS (`42501`) |
| Tenant A insert/select own | PASS |
| Tenant B insert own | PASS |
| Tenant A cannot select Tenant B | PASS (0 rows) |
| Tenant A cannot insert for Tenant B | PASS (RLS WITH CHECK) |
| Tenant A cannot update Tenant B | PASS (0 rows) |
| Tenant A cannot delete Tenant B | PASS (no delete grant / 0 rows) |
| Event insert allowed; update/delete denied | PASS |

Evidence: `RLS_ADAPTER_QA_REPORT.json`

## Financial-integrity QA

| Check | Result |
|-------|--------|
| Valid VND integer-minor insert | PASS |
| Unsupported currency rejected | PASS |
| Negative amount rejected | PASS |
| Invalid lifecycle status rejected | PASS |
| Duplicate provider txn within tenant rejected | PASS |
| Same provider txn allowed across tenants | PASS |
| Duplicate payment attempt number rejected | PASS |
| Duplicate receipt per payment rejected | PASS |
| Secret-bearing evidence metadata rejected | PASS |
| Duplicate event id rejected | PASS |

Evidence: apply `--qa` + `SUPPLEMENTAL_INTEGRITY_QA.json`

## Optimistic-concurrency QA

| Check | Result |
|-------|--------|
| Create at version 1 | PASS |
| Update with expected version → version 2 | PASS (SQL + adapter) |
| Stale version affects 0 rows / Finance conflict | PASS (`FINANCE_OPTIMISTIC_CONCURRENCY_CONFLICT`) |

## Idempotency QA

| Check | Result |
|-------|--------|
| First insert | PASS |
| Duplicate tenant/operation/key rejected | PASS |
| Same key other tenant allowed | PASS |
| Adapter begin/find | PASS |

## Event / receipt immutability QA

| Check | Result |
|-------|--------|
| No UPDATE/DELETE policies on `finance_events` | PASS |
| Authenticated event update/delete denied | PASS |
| No UPDATE policy on `finance_receipts` | PASS |
| Append-only events retained after cleanup | PASS (by design) |

## Adapter certification

Mode: **authenticated Owner A injected Staging client** (no runtime app wiring; no committed secrets).

| Operation | Result |
|-----------|--------|
| create / getById / bounded list | PASS |
| optimistic update + stale reject | PASS |
| idempotency begin/find | PASS |
| Multi-record atomic UoW | Still fail-closed without transactional executor (by design; not claimed) |

## QA data cleanup

- Deleted synthetic `FINANCE_QA_%` fees, payments, attempts, receipts, invoices, evidence, idempotency rows.
- **Retained append-only events** (no ordinary DELETE grant; not weakened):
  - `FINANCE_QA_EVT_001` (`FINANCE_QA_TENANT_A`)
  - `FINANCE_QA_RLS_EVT_*` (`venue-staging-a`)
- All 11 tables remain; RLS/policies unchanged; Billing untouched.

## Unresolved conditions

1. **Permission-negative user probe incomplete:** no Staging account without `finance.view` / `finance.edit` was available with credentials to prove denial for lacking permissions. Tenant isolation + anon denial were proven. Treat as limited certification gap, not an active policy defect.
2. **PITR disabled** on this Staging tier (`pitr_enabled=false`); recovery relies on WALG + Finance rollback SQL for this greenfield apply.
3. **Default Supabase role grants:** inventory shows broad default privileges (including `service_role` and some `authenticated` privilege rows beyond explicit Finance grants). Effective mutation remains gated by RLS policies (no DELETE/UPDATE policies where authored). A future hardening migration may `REVOKE` surplus privileges; out of Phase 1H SQL scope.
4. **No live payment provider**; **no runtime wiring**; **no Production rollout**.

## Explicit non-actions

- No Production apply / access / write  
- No live provider enabled  
- No runtime application wiring or deploy  
- No legacy data migration / backfill  
- No Billing or foreign-module mutation  
- No PR opened  
- No rebase / force-push  
- No credentials committed  

## Supporting artifacts

- `APPLY_REPORT.json`
- `SCHEMA_INVENTORY_SUMMARY.json`
- `RLS_ADAPTER_QA_REPORT.json`
- `SUPPLEMENTAL_INTEGRITY_QA.json`
- `scripts/apply-finance-phase1h-staging-sql.mjs`
- `scripts/verify-finance-phase1h-staging-rls-adapter.mjs`
- `scripts/verify-finance-phase1h-supplemental-integrity.mjs`
- `scripts/probe-finance-phase1h-staging-backup.mjs`
