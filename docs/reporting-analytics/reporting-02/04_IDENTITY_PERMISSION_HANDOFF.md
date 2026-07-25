# REPORTING-02 — Identity Permission Handoff

## Catalog (10 REPORTING-01 actions → Identity `permissions.id`)

| Reporting capability | Identity `permissions.id` | Seed module / action |
|---------------------|---------------------------|----------------------|
| View operational dashboard | `reporting.dashboard.view` | reporting / dashboard.view |
| Execute report | `reporting.report.execute` | reporting / report.execute |
| View sensitive fields | `reporting.field.sensitive.view` | reporting / field.sensitive.view |
| Save report | `reporting.report.save` | reporting / report.save |
| Save filter | `reporting.filter.save` | reporting / filter.save |
| Export report | `reporting.report.export` | reporting / report.export |
| Tenant scope | `reporting.scope.tenant` | reporting / scope.tenant |
| Club scope | `reporting.scope.club` | reporting / scope.club |
| Venue scope | `reporting.scope.venue` | reporting / scope.venue |
| Cross-tenant scope | `reporting.scope.cross_tenant` | reporting / scope.cross_tenant |

**JS source of truth:** `src/features/reporting-analytics/constants/permissions.js`  
**SQL seed (authored only):** `40_REPORTING_02_PERMISSION_SEED.sql`  
**Seed verification (authored only):** `99_REPORTING_02_VERIFICATION.sql` (permission catalog section)

## What REPORTING-02 / REPORTING-03 local remediation does NOT do

- Does **not** modify `src/features/identity/**`
- Does **not** assign roles / `role_permissions`
- Does **not** decide which venue/club roles receive which Reporting actions
- Does **not** broadly grant `reporting.scope.cross_tenant`, `reporting.field.sensitive.view`, or `reporting.report.export`
- Does **not** apply the seed to Staging or Production

## Trusted role-mapping handoff (Owner-gated, separate)

Until a separate Owner-approved `role_permissions` matrix file exists and is applied:

- JWT callers remain **fail-closed** after schema+seed apply (except `is_super_admin()`).
- RLS SELECT continues to call `user_has_permission(...)` — absent grants deny.
- Application authorization in `reportingAuthorize.js` stays fail-closed independently of UI.

Recommended future file (not authored here): Owner-reviewed role assignment SQL under a distinct approval gate — never invent grants in the catalog seed.

## Apply note

Seed order: after RLS helper (`30_…`) and **before** grants (`50_…`) so catalog keys exist when operators verify permission-gated policies. See `README.md` and `05_STAGING_APPLY_MANIFEST.md`.
