# Adapter Contract — Phase 3D

## LegacyTeamAdapter

Map-only bridge: legacy TT team record → `CompetitionTeam`.

## LegacyRosterAdapter

Map-only bridge: legacy TT team/roster shape → `CompetitionRoster`.

Accepts team-shaped sources with `preferRoster` (roster resolve path).

## Must

- Read source without mutation
- Require existing `competitionId` from request/context (do not invent)
- Preserve captain → `captainRef` and deputies → `deputyRefs`
- Preserve roster members / absent markers / lock state where supported
- Fail typed on unsupported status / missing id / missing competitionId
- Keep format extras in `extensions.payload` (color, logo, ratings, snapshots)

## Must not

- Write database / RPC / Supabase
- Call Production TT services
- Update legacy team/roster state
- Process lineup
- Run MLP / scheduling / match algorithms
- Implement substitution workflow (amendments stay empty)
- Import Participant Runtime, Registration Runtime, or app registry
- Coerce unknown statuses silently
- Use `Date.now` / `Math.random` / UUID for identity

## Format adapter note

`teamTournamentParticipantAdapters` remains a separate map-only format surface and is **not** rewritten by Phase 3D.
