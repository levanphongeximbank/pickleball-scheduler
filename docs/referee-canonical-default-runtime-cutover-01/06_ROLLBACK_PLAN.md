# Rollback plan

Revert this branch / PR. No SQL was applied.

## What rollback restores

- `createRefereeCompetitionOperationsFacade` implicit in-memory store (previous default)
- `wiredToProductionRuntime=false` on E2E-04 / adapter integration markers
- Tests that constructed the facade without an explicit store

## What rollback does not touch

- Staging database / RPCs (this run: STAGING_MUTATIONS=0)
- Production (PRODUCTION_ACCESSED=NO)
- Adapter Contract v1 (`1.0.0` locked)
- CORE-13/15/16/17 engines
- Team referee RPCs and Dreambreaker policy
- Referee V5 Edge function

## After merge (later)

If default composition is already on a Staging host, rollback the application/Edge deploy that injects `createDefaultCompetitionRefereeRuntime` before or together with reverting this PR. Do not leave a host calling a removed composition root.

No dual-path “if durable fails use in-memory” rollback is allowed.
