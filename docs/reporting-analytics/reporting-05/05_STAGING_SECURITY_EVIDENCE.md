# REPORTING-05 — Staging Security / RLS / Permission Evidence Summary

## Scope of this workstream

- **No** Staging mutation
- **No** Production access
- **No** SQL apply / migration
- Static SQL package identity re-verified by unit tests
- Live Staging posture referenced from **Owner-accepted REPORTING-03** certification

## Target identity

| Field | Value |
|-------|-------|
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Production project (forbidden) | `expuvcohlcjzvrrauvud` |
| Pre-apply backup SHA256 | `5fd399ce0c23ed414725ee13510c41a1ab1ab120a2f301d03897e54dc36dc050` |

## Owner-accepted live requirements (REPORTING-03)

| Check | Expected / accepted |
|-------|---------------------|
| Reporting tables | 5 present |
| FORCE RLS | all 5 |
| SELECT policies | 5 |
| Write policies | 0 |
| Indexes | 26 (5 PK + 2 UNIQUE idempotency + 19 secondary) |
| `reporting_02_scope_allows(text,text,text,text)` | present |
| Helper compatibility | `user_venue_id()→text`, `user_has_permission(text)→boolean`, `is_super_admin()→boolean` |
| anon Reporting R/W | none |
| authenticated write via policy | not allowed |
| `service_role` grants | trusted boundary only (package) |
| `reporting.*` permissions | exact 10 |
| `role_permissions` for reporting | 0 |
| Live RLS/auth certification | PASS |

## Exact permission ids

1. `reporting.dashboard.view`
2. `reporting.report.execute`
3. `reporting.report.save`
4. `reporting.report.export`
5. `reporting.field.sensitive.view`
6. `reporting.filter.save`
7. `reporting.scope.tenant`
8. `reporting.scope.club`
9. `reporting.scope.venue`
10. `reporting.scope.cross_tenant`

Source of truth (JS): `src/features/reporting-analytics/constants/permissions.js`  
Seed SQL: `docs/reporting-analytics/reporting-02/40_REPORTING_02_PERMISSION_SEED.sql`  
Verification SQL: `docs/reporting-analytics/reporting-02/99_REPORTING_02_VERIFICATION.sql`

## Static package reconfirm (REPORTING-05)

Covered by `tests/reporting-analytics-reporting-02-sql-rls.test.js` and REPORTING-03 permission/manifest tests:

- FORCE RLS statements for all 5 tables
- SELECT-only policies; no INSERT/UPDATE/DELETE policies in RLS file
- anon revoke; authenticated SELECT; service_role DML grants
- no `role_permissions` inserts in seed
- rollback + verification scripts present

## Live MCP reconfirm note

Supabase read-only MCP was **not available** in the REPORTING-05 agent session (empty MCP server catalog). This package therefore does **not** claim a fresh catalog SELECT snapshot beyond Owner-accepted REPORTING-03 live certification.

If a future live catalog SELECT shows drift from the table above: stop and raise `REPORTING_05_BLOCKED_STAGING_SECURITY_DRIFT` — do not auto-repair SQL.
