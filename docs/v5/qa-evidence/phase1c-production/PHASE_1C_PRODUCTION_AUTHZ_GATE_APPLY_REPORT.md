# Phase 1C — Production Authz Gate Apply

- **Status:** **PASS**
- **Production ref:** `expuvcohlcjzvrrauvud` (ACTIVE_HEALTHY)
- **Approved app SHA:** `d7a13982bd3b40913436466a227cc04d1649dcfb`
- **Phase 1C merge (ancestor):** `827a71c50eaf744c77b1e31afbfc774c6241d388`
- **Gate SQL checksum:** `8a512ec1a4dfbb7e52e54d2b71d8fe4c5643a9f7b32e2f4c2e662e74e0cae83e` (matches Staging)
- **SQL apply:** PASS
- **Rollback applied:** false
- **App redeployed:** false
- **Optional Club Owner transfer:** DISABLED

## Target lock

All STEP 1 checks PASS (project, ACTIVE_HEALTHY, not Staging, origin/main, Vercel tip, Phase 1C ancestor, checksum, gate SQL unchanged).

## Catalog (after)

- `phase42_can_assign_club_owner` exists
- assign/clear use narrow helper
- no bare `phase42_is_tenant_member` final authz
- tenant_staff / VENUE_MANAGER / COURT_MANAGER excluded from helper
- Club Owner governance-only path disabled
- SECURITY DEFINER + authenticated EXECUTE preserved
- RLS enabled on clubs / club_members / club_governance_assignments

## Baseline → after

Broad `phase42_is_tenant_member` authz replaced by `phase42_can_assign_club_owner`.
