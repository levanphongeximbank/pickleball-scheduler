# Architecture — Phase 3C

## Layers

| Layer | Path | Role |
|-------|------|------|
| Resolver | `registrations/RegistrationResolver.js` | Orchestrate map / validate / identity / batch |
| Adapter | `registrations/adapters/` | Map-only format bridge |
| Mapper | `registrations/mappers/` | Legacy entry / team / status → CompetitionRegistration |
| Contracts | `registrations/contracts/` | Request / result / identity / adapter shape |
| Domain registration | `participants/contracts/entryRegistration.js` | Owned by 3C — extended fields |
| Errors | `registrations/errors/` | Typed codes + `RegistrationRuntimeError` |
| Ports | `registrations/ports/` | Persistence stub/mock only |
| Services | `registrations/services/` | Identity lookup + normalize/validate |
| Enums | `registrations/enums/` | Kind + source type |

## Public surface (capability-local)

`registrations/index.js` — Option B. Root `competition-core/index.js` is **not** modified.

## Participant dependency

```text
RegistrationResolver({ resolveParticipant })  // optional DI
  → never imports participants/runtime/**
  → never imports app boot / capability registry
```

## Forbidden in this phase

```text
Root competition-core/index.js edits
official unit-test-files.json edits
Canonical adapter
Import-time registry registration
featureFlags enablement
Production persistence / SQL / RLS / RPC
Production route wiring
Runtime cutover
```
