# COACHING-02 — Tenant / Venue Scope Resolution

## Decision: Conclusion A

**Tenant for JWT RLS is venue-bound** under current Platform/Identity Sprint-2 conventions.

## Evidence

| Source | Statement |
|--------|-----------|
| `docs/customer-management/phase-3/03_RLS_AND_AUTHORIZATION_DESIGN.md` | No verified `user_tenant_id()`; policies require `tenant_id = user_venue_id()` and `venue_id = user_venue_id()` |
| `docs/customer-management/phase-3/30_CUSTOMER_PHASE_3_RLS.sql` | Same Sprint-2 note |
| `docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql` | Identical constraint |
| `docs/supabase-rbac.sql` | `user_venue_id()` / `user_club_id()` from `profiles` |
| COACHING-01 Phase 28 note | `tenant_id references venues(id)` flagged as conflicting — replaced by text ids, but JWT binding remains venue helper |

## Naming contract

1. Domain/application continue to use `tenantId` + `clubId` + optional `venueId` (COACHING-01).
2. SQL `tenant_id` is the JWT identity scope column and must equal `user_venue_id()` for authenticated access.
3. SQL optional `venue_id` is a Venue & Court typed reference only — never used as the tenant gate.
4. Tests forbid treating `venue_id` as interchangeable with `tenant_id` for scope allows.

## Not chosen: Conclusion B

Would require a verified tenant helper distinct from venue. That helper does **not** exist. Inventing one is forbidden. Fail-closed venue-bound tenant mapping is the canonical Customer/CRM pattern and is carried forward deliberately — not as a temporary kludge without documentation.
