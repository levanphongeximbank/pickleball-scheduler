# TT-6C — UI Wiring Map

| Page | Hook | Scope | Connection UI |
|------|------|-------|---------------|
| TeamTournamentSetup | useTeamTournamentPage | tournament | banner |
| TeamPortal | useTeamTournamentPage | tournament | banner |
| TeamRefereePortal | useTeamTournamentPage | tournament | banner |
| RefereeV5TeamMatchPage | useTeamTournamentRealtime | tournament (access reload) | chip |
| RefereeV5Workspace | useRefereeRealtimeSync (existing V5) | referee_match | RefereeConnectionStatus |

No page creates Supabase channels directly.

## Polling interaction

- Flag off or degraded: page 5s poll + service fallback
- Flag on + connected: page poll disabled; service owns reconnect/fallback

## Captain security

Lineup detail via `getVisibleLineups` RPC only. WAL envelopes exclude selections.
