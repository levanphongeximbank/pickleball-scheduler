# Architecture — Phase 3F

## Layers

| Layer | Path | Role |
|-------|------|------|
| MatchResolver | `matches/MatchResolver.js` | Map / validate / identity / batch |
| Adapter | `matches/adapters/` | Map-only format bridge |
| Mapper | `matches/mappers/` | Legacy match/subMatch → canonical + status |
| Contracts | `matches/contracts/` | Match / Side / ResultReference / identity / policy |
| Errors | `matches/errors/` | Typed codes + `MatchRuntimeError` |
| Ports | `matches/ports/` | Persistence stub/mock only |
| Policies | `matches/policies/` | Injected format rules (noop default) |
| Services | `matches/services/` | Normalize, sides, transitions, identity lookup |

## Dependency injection

```text
createMatchResolver({
  adapters?,
  identityLookup?,
  persistence?,
  enablePersistence?,   // default false
  matchPolicy?,
  resolveFixture?,
  resolveTeam?,
  resolveRoster?,
  resolveLineup?,
  resolveParticipantReference?,
  resolveRegistration?,
  getMatchContext?,
  getCourtAssignment?,
  getRefereeAssignment?,
  getResultReference?,
  clock?,
})
```

Never imports:

- `participants/runtime/**`
- `registrations/**`
- `teams/**` (deep)
- `lineups/**` (deep)
- Team Tournament engines / UI
- Supabase / app boot / capability registry
- Scoring engines / winner calculation

## Lifecycle (Core)

```text
DRAFT → READY → SCHEDULED → READY_TO_START → IN_PROGRESS ⇄ SUSPENDED → COMPLETED
                         ↘ LINEUPS_PENDING ↗ (optional / policy)
POSTPONED ⇄ SCHEDULED
* → CANCELLED (terminal)
COMPLETED / CANCELLED immutable
```

Completion outcomes (WALKOVER / FORFEIT / ABANDONED) are `completionReason` + opaque `resultReference`, not Core statuses.

## Out of scope

Match Runtime / random lineup / deadline scheduler / Scoring Runtime / Scheduling Runtime / court & referee allocation / UI
