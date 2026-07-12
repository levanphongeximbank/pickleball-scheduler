# ADR-006: Result Finalization and Idempotency

**Status:** Proposed (V5-A)  
**Date:** 2026-07-12

## Context

Classic finalize splits: RPC `finalize_requested` → client blob persist → `markMatchLiveProcessed`. Risk of duplicate bracket/rating updates.

## Decision

Single RPC **`referee_v5_finalize_match_result`** in one PostgreSQL transaction:

1. Auth + assignment check  
2. Idempotency check (`match_sync_mutations`)  
3. Version check  
4. Validate/replay events → official scores  
5. Lock `match_live_states`  
6. Insert `match_result_revisions`  
7. Update bracket/standings (or enqueue domain job)  
8. Team tie aggregate if applicable  
9. Rating V5 evidence hook (no direct rating write from referee RPC)  
10. Audit + notification  
11. COMMIT  

Duplicate finalize with same idempotency key → return prior result (200), no double side effects.

## Consequences

- Pattern aligns with `team_tournament_command_log` (TT-1B).
- Frontend must not call bracket/rating services directly after finalize.

## Alternatives rejected

- **Client-orchestrated multi-step:** current Director queue — rejected.
