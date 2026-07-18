# Architecture — Phase 3D

## Layers

| Layer | Path | Role |
|-------|------|------|
| TeamResolver | `teams/TeamResolver.js` | Map / validate / identity / batch |
| RosterResolver | `teams/RosterResolver.js` | Map / validate / identity / batch |
| Adapter | `teams/adapters/` | Map-only format bridge |
| Mapper | `teams/mappers/` | Legacy team / roster → canonical |
| Contracts | `teams/contracts/` | Request / result / identity / adapter shape |
| Domain | `participants/contracts/teamRosterLineup.js` | Team/roster factories (+ identityKey) |
| Errors | `teams/errors/` | Typed codes + `TeamRuntimeError` |
| Ports | `teams/ports/` | Persistence stub/mock only |
| Services | `teams/services/` | Identity lookup + normalize/validate |
| Enums | `teams/enums/` | Source types |

## Public surface (capability-local)

`teams/index.js` — Option B. Root `competition-core/index.js` is **not** modified.

## Participant dependency

```text
TeamResolver({ resolveParticipant })   // optional DI
RosterResolver({ resolveParticipant }) // optional DI
  → never imports participants/runtime/**
  → never imports registrations/**
  → never imports app boot / capability registry
```

## Forbidden in this phase

```text
Root competition-core/index.js edits
official unit-test-files.json edits
registrations/** edits
Lineup / MLP / Match / Scheduling / substitution workflow
Canonical Production adapter
Import-time registry registration
featureFlags enablement
Shadow enablement
Production persistence / SQL / RLS / RPC
Production route wiring
Runtime cutover
```
