# 03 — Tenant / Venue Resolver Certification (Phase 1H-A)

**Verdict: `SAME_SCOPE_MODEL_VERIFIED`**

Offline/static certification only. No live database connection.

## Question

Does current platform data support:

1. tenant and venue as the same identifier for JWT RLS, or
2. tenant and venue as distinct identifiers with a verified tenant resolver?

## Evidence inspected

| Artifact | Finding |
|----------|---------|
| `public.user_venue_id()` (`docs/supabase-rbac.sql`) | Returns `profiles.venue_id` for active `auth.uid()` |
| `user_tenant_id()` | **Not found** as a verified distinct helper |
| Phase 1G `crm_phase1g_scope_allows` | Requires `tenant_id = user_venue_id()` AND `venue_id = user_venue_id()` |
| CRM app `createTenantVenueScope` | Allows distinct ids in memory/tests; fail-closed if either missing |
| First-venue / first-tenant fallback | **Absent** in CRM Phase 1G RLS |
| Nullable permissive policy | **Absent** — missing `user_venue_id()` denies |

## Certification rules applied

- Never weaken RLS to make it pass
- Missing context denies access
- No first-club / first-tenant / first-venue fallback
- If distinct scope were required without a verified tenant resolver → would be `BLOCKED_MISSING_TENANT_RESOLVER`

## Outcome

**`SAME_SCOPE_MODEL_VERIFIED`**

For JWT-backed durable CRM rows, Sprint-2 identity binds callers via `profiles.venue_id`. Phase 1G correctly treats `tenant_id` and `venue_id` as the same identifier equal to `user_venue_id()`. Rows with `tenant_id <> venue_id` are JWT-inaccessible (fail-closed), which is intentional until Identity publishes a verified dual-scope helper.

Application memory/tests may still use distinct ids; durable Staging data must use equal tenant/venue ids matching the caller's venue.

## Remediation design (if product later requires distinct scope)

1. Identity authors and certifies `user_tenant_id()` (or equivalent) with fail-closed null behavior.
2. New corrective CRM migration updates `crm_phase1g_scope_allows` (prefer additive Phase 1H+/1I migration; do not weaken).
3. Re-certify RLS/RPC and post-apply QA.
4. Until then: keep SAME_SCOPE; do not author permissive RLS.

## Constants

`src/features/crm/identity/tenantVenueResolverCertification.js`
