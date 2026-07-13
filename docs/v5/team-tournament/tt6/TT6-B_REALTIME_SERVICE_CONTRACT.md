# TT-6B — Realtime Service Contract

See `src/features/team-tournament/realtime/TeamTournamentRealtimeService.js`.

## API

- `subscribeTournament({ tenantId, tournamentId, clubId, handlers, refreshSnapshot, pollingOnly? })`
- `subscribeMatchup({ tenantId, tournamentId, matchupId, ... })`
- `subscribeSubMatch({ tenantId, tournamentId, subMatchId, ... })`
- `subscribeRefereeMatch({ tenantId, tournamentId, externalSubMatchId, currentVersionRef, isProcessingRef, refreshSnapshot })`
- `unsubscribe(subscriptionId)` / `unsubscribeAll()`
- `reconnect(subscriptionId?)`
- `refreshSnapshot(scope?)`
- `getConnectionState(subscriptionId?)`
- `onConnectionStateChange(handler)`

## Repository

`cloudTeamTournamentRepository.subscribeTournament()` delegates to service.

Returns `{ subscriptionId, unsubscribe, fallbackMode, pollingIntervalMs, mode }`.

## Flag

`VITE_TT_REALTIME_ENABLED=true` required for Realtime channels. Default **false**.
