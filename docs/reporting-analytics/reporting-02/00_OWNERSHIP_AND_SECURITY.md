# REPORTING-02 — Ownership & Security Notes

## Namespace

All durable tables use the `reporting_*` prefix under schema `public`.

Intentionally **not** colliding with:

- `communication_message_reports` (Communication moderation)
- Statistics feature tables / views
- Intelligence & Analytics projections / metric registry storage

## Identity binding (Sprint-2)

Verified JWT binding is `profiles.venue_id` via `public.user_venue_id()`. No verified dual-scope `user_tenant_id()` distinct from venue exists.

Therefore RLS requires:

- `tenant_id = public.user_venue_id()` for tenant-bound rows
- when `venue_id` is present: `venue_id = public.user_venue_id()`

Rows where `tenant_id <> user_venue_id()` are inaccessible via authenticated JWT until Identity publishes a verified tenant helper. This is fail-closed.

`PLATFORM_CROSS_TENANT` rows are denied for authenticated JWT by default; only `is_super_admin()` or explicit `reporting.scope.cross_tenant` may SELECT.

## Write boundary

Authenticated INSERT/UPDATE/DELETE policies are **absent**. Aggregate and lifecycle writes go through trusted service-role / server adapters that still enforce Reporting application authorization.

Clients cannot self-mark records as cross-tenant, shared, or authorized, and cannot advance execution/export status to succeeded.

## Data classification

Execution rows store metadata, provenance, freshness, row/count summaries, and error codes. They do **not** store raw sensitive result rows by default.

Export jobs store artifact **references** and safe content metadata — not file bytes and not fabricated download URLs.
