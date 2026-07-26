# Ranking (VPR) — Closure Evidence

**Module:** Ranking / VPR  
**Canonical path:** `src/features/vpr-ranking/`  
**Classification:** `FULLY_COMPLETED_CLOSED`  
**Note:** Flag OFF does **not** auto-block

## Why flag OFF is not an implementation gap

1. Canonical Ranking implementation exists on `main`.  
2. Local/dev adapter (`vprLocalStore.js`) is **explicit** when cloud sync/RPC is unavailable.  
3. Production enablement is a deferred gate, not a missing SSOT.  
4. No active duplicate SSOT vs Player Rating (boundaries documented in BM-FINAL-RATING-01 `05_PLAYER_COMPETITION_RANKING_BOUNDARIES.md`).

## Canonical surfaces

| Dimension | Path / authority |
|-----------|------------------|
| Public facade | `src/features/vpr-ranking/index.js` |
| Ownership | VPR points, certification workflow, leaderboard, athlete ranking links |
| Non-ownership | Player Rating skill SSOT; Competition Elo |
| Flags | `VITE_VPR_RANKING_ENABLED` / `VITE_VPR_CLOUD_SYNC` (`vprFlags.js`) |
| Persistence | Phase 29 SQL/RPC when enabled; otherwise explicit local keys |
| Authorization | RBAC `ranking.view` / `ranking.manage` / `tournament.certify` |
| Platform Core | `src/features/vpr-ranking/platform/` |
| External ports | Tournament bridge; public portal presentation consumers |

## Tests (targeted)

- `tests/vpr-calculation-engine.test.js`
- `tests/vpr-certification-workflow.test.js`
- `tests/vpr-rbac.test.js`
- `tests/vpr-placement-resolver.test.js`

## Deferred gates

- `RANKING_STAGING_SQL_APPLY`
- `RANKING_PRODUCTION_FLAG_ENABLEMENT`
- `RANKING_CLOUD_SYNC_ENABLEMENT`

## Verdict

Canonical Ranking implementation is closed for Owner-locked structural scope.  
Production flag enablement is deferred and registered. No domain source change required.
