# Staging application acceptance plan

This run: AUDIT + LOCAL IMPLEMENTATION + LOCAL CERTIFICATION only.

STAGING_MUTATIONS=0  
STAGING_APPLICATION_PATH_CERTIFIED=NO

Owner must separately authorize live Staging application-path certification.

## Preconditions (already true from prior workstreams)

- PR #431 Adapter Contract v1 locked
- PR #433 durable runtime implemented
- Staging backend tables/RPCs compatible (`referee_assignments`, `match_live_states`, `match_events`, `match_result_revisions`, `match_sync_mutations`, internal commit RPCs)
- RLS not weakened

## What Staging GO must prove

1. A **server/Edge** host constructs `createDefaultCompetitionRefereeRuntime({ rpcClient })` with a service-role client from **server** env (not `VITE_*`).
2. Browser continues to send only authenticated user intent.
3. Assigned referee command commits through durable tables (CORE-15/16/17 payloads).
4. Unassigned / cross-tenant / stale `expectedVersion` / conflicting idempotency fail closed.
5. Fresh read equals committed state.
6. CORE-17 accepted revision history (ACTIVE / SUPERSEDED) holds.
7. Authenticated/anon clients cannot execute internal commit RPCs.
8. No dual write to a second scoring or result authority.
9. Team parent/child/Dreambreaker behavior unchanged (Team suites, not generic runtime).

## Out of scope until Owner GO

- Applying SQL
- Deploying a new Edge function
- Mutating Staging data
- Production access
- Adapter B mode adapters
- Referee UI

## Smallest Staging host (when authorized)

Reuse existing Edge secret boundary (`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`) or an equivalent serverless host. Inject `rpcClient`; do not ship the key to Vite.
