# REPORTING-03 — Staging Apply Manifest (DO NOT EXECUTE WITHOUT OWNER GO)

**Historical status:** Prepared for Owner-authorized Staging apply.
**Post-apply (Owner-accepted):** Staging apply + live RLS/auth certification **PASS** under REPORTING-03 closure.
**REPORTING-05:** Do **not** re-apply or mutate Staging from this manifest. Treat as historical runbook + rollback reference.
**Re-apply without Owner GO remains forbidden:** `REPORTING_03_STAGING_APPLY_NOT_AUTHORIZED`
**Production:** Still prohibited.

## Target

| Field | Value |
|-------|--------|
| Environment | **Staging only** |
| Project ref (required) | `qyewbxjsiiyufanzcjcq` |
| Production ref (prohibited) | `expuvcohlcjzvrrauvud` |
| Branch / worktree | `feature/bm-reporting-03-staging-apply-projection-integration` |

## Prerequisites (all required before any SQL)

1. Draft PR CI green for this branch.
2. Fresh Staging **logical backup** created immediately before apply, with **SHA256** and readability verification (Owner decision accepted for Staging).
3. Re-verify project ref = `qyewbxjsiiyufanzcjcq` (refuse if Production).
4. Re-verify helpers: `user_venue_id()`, `user_has_permission(text)`, `is_super_admin()`.
5. Re-verify Reporting objects still **ABSENT** (or document Owner-approved re-apply posture).
6. Collision recheck (Reporting-owned / SQL package).
7. **Explicit Owner GO** for Staging apply (separate from this manifest).

## Pre-apply object absence checks (catalog SELECT only)

Confirm absent (or empty greenfield):

- Tables: `reporting_report_definitions`, `reporting_saved_reports`, `reporting_saved_filters`, `reporting_executions`, `reporting_export_jobs`
- Function: `reporting_02_scope_allows(text,text,text,text)`
- Policies / indexes named `reporting_%`

## Apply order (exact filenames)

| Step | File | Notes |
|------|------|--------|
| 1 | `10_REPORTING_02_TABLES.sql` | DDL tables |
| 2 | `20_REPORTING_02_INDEXES.sql` | Indexes |
| 3 | `30_REPORTING_02_RLS.sql` | Scope helper + FORCE RLS + SELECT policies |
| 4 | `40_REPORTING_02_PERMISSION_SEED.sql` | Catalog only — **no** `role_permissions` |
| 5 | `50_REPORTING_02_GRANTS.sql` | authenticated SELECT; trusted server-adapter DML |
| 6 | `99_REPORTING_02_VERIFICATION.sql` | Read-only verify |

## Post-apply verification order

1. Run `99_REPORTING_02_VERIFICATION.sql` (tables, FORCE RLS, scope helper, 10 permission ids).
2. Confirm `reporting_role_permission_rows = 0` unless Owner separately approved a matrix.
3. Smoke: helpers still present; no anon table grants on `reporting_%`.

## Rollback decision conditions

Use after backup + Owner authorization:

1. Schema objects: `90_REPORTING_02_ROLLBACK.sql`
2. Permission catalog only: `91_REPORTING_02_PERMISSION_SEED_ROLLBACK.sql` (refuses if `role_permissions` still reference reporting ids)

## Explicit prohibitions

- **No Production access or apply**
- **No credentials / secrets in this manifest**
- **No automatic apply** from CI, scripts, or MCP without Owner GO
- **No** undocumented Supabase CLI database-push / migration runners in this gate
- Permission seed does **not** authorize broad cross-tenant, sensitive-field, or export role grants

## Backup contract (Staging)

Owner accepts: fresh logical backup immediately before apply + SHA256 + readability check + Reporting rollback package.  
Creating the backup and executing this manifest require **separate** Owner actions beyond this document.
