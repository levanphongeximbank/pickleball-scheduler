# TT-6C — Implementation Summary

**Date:** 2026-07-13  
**Branch:** `feature/tt6-realtime-sync`  
**Base:** TT-6B `26076d8`  
**Production:** UNTOUCHED

## Delivered

| Area | Path |
|------|------|
| Shared hook | `src/features/team-tournament/ui/useTeamTournamentRealtime.js` |
| Page integration | `useTeamTournamentPage.js` — suppresses duplicate polling when realtime connected |
| Connection UI | `RealtimeConnectionStatus.jsx`, `realtimeConnectionLabels.js` |
| BTC Setup | `TeamTournamentSetup.jsx` |
| Captain Portal | `TeamPortal.jsx` |
| Legacy referee desk | `TeamRefereePortal.jsx` |
| Referee V5 match | `RefereeV5TeamMatchPage.jsx` — access refresh via repository subscribe |
| Verify | `scripts/verify-phase-tt6c-staging.mjs`, `verify-phase-tt6c-preview-smoke.mjs` |
| Tests | `tests/team-tournament-tt6c.test.js`, `tests/ui/team-tournament-realtime-ui.test.jsx` |

## Pattern

Page → `useTeamTournamentPage` → `useTeamTournamentRealtime` → `repo.subscribeTournament` → TT-6B service.

Realtime hint → coalesced `reload({ silent: true })` → server-authoritative snapshot. No client standings mutation.

## Flag

`VITE_TT_REALTIME_ENABLED=true` — Staging/Preview only. Default `false`. Rollback: `false`.

## Not in TT-6C

- TT-6D observability hardening
- Offline queue production
- DreamBreaker realtime
- Production SQL/deploy
