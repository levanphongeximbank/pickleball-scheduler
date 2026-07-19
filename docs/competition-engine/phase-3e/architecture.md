# Architecture — Phase 3E

## Layers

| Layer | Path | Role |
|-------|------|------|
| LineupResolver | `lineups/LineupResolver.js` | Map / validate / identity / batch |
| Adapter | `lineups/adapters/` | Map-only format bridge |
| Mapper | `lineups/mappers/` | Legacy lineup → canonical + status |
| Contracts | `lineups/contracts/` | Request / result / identity / policy / adapter |
| Domain factories | `participants/contracts/teamRosterLineup.js` | Lineup / Slot / Revision (+ identityKey) |
| Errors | `lineups/errors/` | Typed codes + `LineupRuntimeError` |
| Ports | `lineups/ports/` | Persistence stub/mock only |
| Policies | `lineups/policies/` | Injected format rules (noop default) |
| Services | `lineups/services/` | Normalize, membership, transitions, identity lookup |

## Dependency injection

```text
createLineupResolver({
  adapters?,
  identityLookup?,
  persistence?,
  enablePersistence?,   // default false
  lineupPolicy?,
  resolveTeam?,          // optional DI
  resolveRoster?,        // optional DI
  resolveParticipant?,   // optional DI
  getMatchContext?,      // optional DI
  clock?,                // optional DI
})
```

Never imports:

- `participants/runtime/**`
- `registrations/**`
- `teams/**` (deep)
- Team Tournament engines / UI
- Supabase / app boot / capability registry

## Forbidden in this phase

```text
Root competition-core/index.js edits
official unit-test-files.json edits
registrations/** edits
teams/** edits
Match Runtime / random lineup / deadline scheduler
Canonical Production adapter
Import-time registry registration
featureFlags enablement
Shadow enablement
Production persistence / SQL / RLS / RPC
Production route wiring
Runtime cutover
```
