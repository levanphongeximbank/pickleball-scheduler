# REPORTING-02 — Durable Report Persistence, Execution & Export

**Status:** SQL authored only. **Do not apply** to Staging or Production without separate Owner authorization.

## Ownership

| Table | Owner |
|-------|--------|
| `reporting_report_definitions` | Reporting & Analytics |
| `reporting_saved_reports` | Reporting & Analytics |
| `reporting_saved_filters` | Reporting & Analytics |
| `reporting_executions` | Reporting & Analytics |
| `reporting_export_jobs` | Reporting & Analytics |

Does **not** own Statistics business truth, I&A metric registry/query runtime, dashboard UI, or `communication_message_reports` (COMMS moderation).

## Apply order (forward)

1. `10_REPORTING_02_TABLES.sql`
2. `20_REPORTING_02_INDEXES.sql`
3. `30_REPORTING_02_RLS.sql`
4. `40_REPORTING_02_PERMISSION_SEED.sql` (catalog only — no `role_permissions`)
5. `50_REPORTING_02_GRANTS.sql`
6. `99_REPORTING_02_VERIFICATION.sql` (read-only checks)

Permission handoff (no auto role grants): `04_IDENTITY_PERMISSION_HANDOFF.md`
Staging apply manifest (do not execute without Owner GO): `05_STAGING_APPLY_MANIFEST.md`

## Rollback order

1. `90_REPORTING_02_ROLLBACK.sql` — tables / policies / indexes / scope helper
2. `91_REPORTING_02_PERMISSION_SEED_ROLLBACK.sql` — exact 10 `reporting.*` catalog rows only (refuses if still referenced by `role_permissions`)

Only under Owner authorization after backup.

## Security notes

- RLS fail-closed using verified helpers only: `auth.uid()`, `public.user_venue_id()`, `public.user_has_permission(text)`, `public.is_super_admin()`.
- No `USING (true)` / `WITH CHECK (true)`.
- No anon policies or grants.
- Authenticated: SELECT only (permission-gated). Writes via trusted `service_role` / server adapters.
- Execution/export status transitions are not writable by authenticated JWT clients.
- Service-level authorization in the Reporting application layer runs **before** repository/source/export execution; RLS supplements, does not replace.

## REPORTING-03 handoff

See `03_REPORTING_03_HANDOFF.md`.
