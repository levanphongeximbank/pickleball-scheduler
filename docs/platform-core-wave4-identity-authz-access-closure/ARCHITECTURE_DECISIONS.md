# Wave 4 architecture decisions

| Decision | Lock |
|---|---|
| Tenant entitlement | `tenant_members` (existing table) is Tenant **operational** entitlement only. `profiles.tenant_id` is home/default **context hint**. Selected Tenant is target only. |
| Venue entitlement | `profiles.venue_id` = home/default Venue. Selected Venue is preference only. |
| Club entitlement | `club_members` / membership RPC snapshot via bound port. `profiles.club_id` is not the sole grant. |
| Login venue→tenant bridge | Retired from Actor/authz projection. `legacyTenantVenueBridge` remains for Wave 3 local venue bootstrap only. |
| DB `user_tenant_id()` COALESCE | Not retired. Wave 3 SQL stays. `DATABASE_USER_TENANT_VENUE_FALLBACK_RETIRE=NOT_YET`. |
| Super Admin | Directory global. Authorization global. Operational mutations require explicit target. Membership not required. |
| SYSTEM_TECHNICIAN | Not a second Super Admin. Explicit technical capabilities only. No all-club / all-venue / all-tenant business grants. Unscoped business capability DENY. |
| Secure runtime RBAC-off | Fail closed (deny), never allow-all. |
| Local non-secure RBAC-off | Allowed. |
| Secure identity RPC fallback | Denied. No `profiles.select("*")` privileged fallback. `IDENTITY_RPC_CANONICAL_SCOPE_GAP=OPEN`. |
| Platform Core → Contract #01 | Forbidden. Reverse dependencies remain 0. |
| Schema / SQL / RLS | Staging remediation package **authored** under `staging-remediation/`. **Not executed.** |

## Identity projection

`src/features/identity/services/canonicalActorProjection.js`

- `subjectId` = `profiles.id` = `auth.uid`
- `tenantId` from `profiles.tenant_id` only
- `venueId` from `profiles.venue_id` only
- missing status → `IDENTITY_INCOMPLETE` (never `ACTIVE`)

## Entitlement ports

Neutral bind/snapshot lives in `src/core/platform/authz/`. Adapters are injected from `src/main.jsx`.
