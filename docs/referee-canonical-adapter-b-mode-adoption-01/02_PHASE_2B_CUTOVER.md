# Referee Adapter B — Phase 2B Canonical Cutover

## Scope

Cut over canonical default/production referee composition to:

`usesAdapterB=true`

Path:

```
Competition Mode
  → Mode Adapter B (translator only)
  → competition.referee.adapter.v1
  → E2E-04 facade
  → CORE-13 / CORE-15 / CORE-16 / CORE-17
  → Canonical Durable Referee Runtime
```

## Flags

| Flag | Value |
|------|-------|
| `usesAdapterB` (default/production runtime) | `true` |
| `usesAdapterBProductionCutover` | `true` |
| `stagingBackendCertified` | `true` (Staging application-path certified; see `evidence/PHASE_2B_STAGING_CERTIFICATION.md`) |

## Fail-closed rules

- Unknown mode → fail closed
- Missing/malformed mode state → fail closed
- Daily Play without canonical assignment authority → fail closed (no legacy score fallback)
- Adapter B pre-start blockers → deny open
- Result propagation cannot bypass CORE-17 accepted result
- No silent legacy fallback after Adapter B error

## Compatibility

Bare `createRefereeCompetitionOperationsFacade` without `usesAdapterB` remains a TEST_DOUBLE / legacy compatibility surface. It is not selected as canonical fallback from the cutover path.

## Tests

- `tests/competition-engine-referee-adapter-b-phase-2b-cutover-01.test.js`
- Side-loaded via `tests/competition-engine-e2e-04-player-referee-operations.test.js`
