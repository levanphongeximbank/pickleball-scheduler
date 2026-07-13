# TT-6B — Implementation Report

**Date:** 2026-07-13  
**Branch:** `feature/tt6-realtime-sync`  
**Production:** UNTOUCHED

## Delivered

| Module | Path |
|--------|------|
| Core service | `src/features/team-tournament/realtime/TeamTournamentRealtimeService.js` |
| Envelope | `realtimeEventEnvelope.js` |
| Dedupe | `realtimeDeduplicator.js` |
| Connection FSM | `realtimeConnectionState.js` |
| Polling | `realtimePollingFallback.js` |
| Referee adapter | `refereeV5RealtimeAdapter.js` |
| Observability | `realtimeObservability.js` |
| Feature flag | `realtimeFlags.js` — `VITE_TT_REALTIME_ENABLED` |
| Repository delegate | `teamTournamentRealtimeRepository.js` |

## Pattern

Realtime hint → validate envelope → dedupe → snapshot reload (repository RPC) → UI state from server.

## Not in TT-6B

- Page wiring (TeamPortal, Setup, Referee UI)
- TT-6C multi-device UI
- Production SQL/deploy

## SQL (staging proposal)

- `TT6-B_REALTIME_SECURITY.sql` — RLS SELECT policies
- `TT6-B_REALTIME_CORE.sql` — publication adds (matchups, sub_matches, bridge)

Apply: `node scripts/apply-phase-tt6b-staging-sql.mjs`

## Verify

`node scripts/verify-phase-tt6b-staging.mjs`

## Tests

`node --test tests/team-tournament-tt6b.test.js`
