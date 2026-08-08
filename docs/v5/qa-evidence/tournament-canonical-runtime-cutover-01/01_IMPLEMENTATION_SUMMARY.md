# Tournament Canonical Runtime Cutover 01 — Implementation Summary

**Branch:** `fix/tournament-canonical-runtime-cutover-01`  
**Base:** `06e5c7058e1a8297cea2c61171198173936c10ad`  
**Live mutations:** none

## What landed locally

1. Canonical Tournament application boundary under `src/features/tournament/`:
   - repository factory (`transitional_blob` | `cloud`)
   - queries / commands / application facade
   - Vietnamese labels + hub lifecycle nav
2. Canonical primary pages for hub/create/list/types/roster/register/organize/operations/results/my.
3. Daily Play entry rewired through canonical create/list commands (“Chơi hằng ngày”).
4. Public tournaments default → remote catalog; mock fallback disabled for tournaments list.
5. Team Tournament cloud_only unlockable via `VITE_TOURNAMENT_CANONICAL_CUTOVER=true` (no new local mirror).
6. EngineV4 apply path centralized as `applyEngineV4StateCommand` (contextual engine).
7. Local SQL package for `canonical_tournaments` + RPCs (not applied).

## Intentionally deferred to Owner live GO

- Apply `sql/10_CANONICAL_TOURNAMENTS.sql`
- Set `VITE_TOURNAMENT_CANONICAL_DATA_MODE=cloud`
- Set `VITE_TOURNAMENT_CANONICAL_CUTOVER=true` + TT `cloud_only` in Production/Staging
- Data migration from club blob / `club_data_v3` into `canonical_tournaments`
