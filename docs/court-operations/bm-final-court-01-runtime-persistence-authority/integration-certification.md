# Integration certification

## Venue / Court

- Court Engine continues to read inventory via `loadCourtsForClubScoped` and availability via `courtEngineAvailabilityGuard`.
- Confirmation / transfer still re-check availability.
- No Venue inventory mutation added.

## Competition

- Competition Core / Management internals not modified.
- Competition retains demand/assignment/schedule ownership.
- No Competition inventory writes from Court Operations.

## Club / tenant scope

- Runtime commands require `tenantId` + `clubId`.
- Cross-tenant / cross-club mismatch fail-closed.
- No first-club / first-venue fallback in the canonical writer.

## Court-cluster claims

- Durable mode: RPC success only; `NO_SUPABASE` / `RPC_NOT_DEPLOYED` / `RPC_FAILED` fail-closed (no local success).
- Explicit local authority still allows local claim adapter for development/offline/tests.
- Cluster inventory/admin ownership unchanged.
