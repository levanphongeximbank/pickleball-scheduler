# Legacy `public.tenants` view — cutover status

**Do not drop this view in Wave 3 Phase B.** 
Owner gate to drop: `OWNER_DROP_PUBLIC_TENANTS_VIEW=YES` after every reader below is retired or remapped.

The view is a Sprint 2 **venue alias** (`docs/supabase-multi-tenant-sprint2.sql`).
It is **not** Tenant identity authority. Canonical durable Tenant is
`public.platform_tenants`.

## Retirement / cutover condition

All of the following:

1. App runtime has zero `.from("tenants")` / `public.tenants` identity reads
2. Operational checklists that `SELECT` from `public.tenants` are rewritten to `platform_tenants` or explicitly marked historical
3. Security-invoker view certification for `public.tenants` is either re-homed or retired
4. `platform_tenants` is CLOUD_CANONICAL in production runtime
5. Owner sets `OWNER_DROP_PUBLIC_TENANTS_VIEW=YES`

## Reader classification

| Reader | Class | Notes |
|---|---|---|
| `src/**` application runtime | **DEAD** | No `.from("tenants")` in `src/` |
| `src/core/platform/app/platformTenantAuthority.js` | **DEAD** (forbidden) | Explicitly refuses table name `tenants` |
| `src/features/billing/services/billingVenueService.js` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Reads `venues`, not `tenants`. Billing still keys some RLS by venue-shaped tenant id until subscription policy rewrite GO |
| `scripts/verify-phase6-security-invoker-views-staging.mjs` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Certifies the view; not Tenant authority |
| `docs/supabase-multi-tenant-sprint2.sql` | **TRANSITIONAL_BRIDGE** | Defines the view |
| `docs/v6/security-invoker-view-remediation-01/*` | **TRANSITIONAL_BRIDGE** | `security_invoker` on the view |
| `docs/supabase-multi-tenant-sprint2-rollback.sql` | **TRANSITIONAL_BRIDGE** | Historical drop script; not authorized here |
| `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | `select * from public.tenants limit 3` |
| `docs/SUPABASE-STAGING-CHECKLIST.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Documents alias tenant = venue |
| `docs/v5/GATE_2_SQL_VERIFICATION_QUERIES.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Historical Gate 2 probe |
| `docs/v5/GATE_2_BATCH_A_OWNER_STEP_BY_STEP.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Historical Gate 2 probe |
| `docs/v5/PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Historical pack |
| `docs/v5/PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Historical handoff |
| `docs/MULTI-TENANT-SPRINT2-CHECKLIST.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Sprint 2 checklist |
| `docs/v6/security-invoker-view-remediation-01/POST_APPLY_CERTIFICATION.md` | **OUT_OF_SCOPE_WITH_EXPLICIT_CUTOVER_GATE** | Isolation certification of the view |
| Wave 3 `01_PRECHECK.sql` | **TRANSITIONAL_BRIDGE** | Inventories view vs table; does not read it as authority |

**MIGRATE_NOW:** none. No live app identity reader remains on the view.

Competition Platform is not a reader and must not become Tenant authority.
