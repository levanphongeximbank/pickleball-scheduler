# Architecture — Phase 3B

## Layers

| Layer | Path | Role |
|-------|------|------|
| Resolver | `participants/runtime/ParticipantResolver.js` | Orchestrate resolve / normalize / validate / identity / adapter select |
| Adapter | `participants/runtime/adapters/` | Map-only format bridge |
| Mapper | `participants/runtime/mappers/` | Legacy → CompetitionParticipant (immutable source) |
| Contracts | `participants/runtime/contracts/` | Request / result / adapter shape |
| Domain identity | `participants/contracts/identity.js` | `ParticipantIdentity` + key helpers |
| Domain participant | `participants/contracts/competitionParticipant.js` | Unchanged factory behavior |
| Errors | `participants/runtime/errors/` | Typed codes + `ParticipantRuntimeError` |
| Ports | `participants/runtime/ports/` | Persistence abstraction (stub/mock only) |
| Services | `participants/runtime/services/` | Identity lookup + normalize/validate |
| Shadow helpers | `participants/runtime/shadow/` | Non-Production compare/normalize |

## Public surface (capability-local)

`participants/runtime/index.js` — Option B. Root `competition-core/index.js` is **not** modified (Integrator Wave 1).

## Forbidden in this phase

```text
Canonical adapter
Import-time registry registration
featureFlags enablement
Production persistence / SQL / RLS
Production route wiring
entryRegistration / teamRosterLineup edits
official unit-test-files.json edits
```
