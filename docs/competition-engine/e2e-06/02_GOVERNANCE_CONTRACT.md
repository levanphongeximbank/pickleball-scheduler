# E2E-06 — Governance Contract

## Facade

`createCompetitionGovernanceReliabilityFacade(deps?)`

Marker: `COMPETITION_ENGINE_GOVERNANCE_RELIABILITY`

### Required query fields

- `tenantId` (explicit)
- `competitionId` (explicit)
- `actor.actorId` + `actor.role` (privileged queries)
- `governanceRecord` (explicit evidence snapshot; no silent invention)

### Methods

| Method | Action | Result |
|--------|--------|--------|
| `getGovernanceState` | `governance.read` | Full governance projection |
| `evaluateOperationReadiness` | `governance.reliability.evaluate` | Policy evaluation for operation |
| `evaluatePublicationReadiness` | reliability | CM-06 handoff readiness |
| `evaluateCompletionReadiness` | reliability | Completion path readiness |
| `evaluateArchiveReadiness` | `governance.archive.evaluate` | CM-08 handoff readiness |
| `evaluateRecoveryReadiness` | `governance.recovery.evaluate` | CORE-23 handoff readiness |
| `evaluateReplayReadiness` | `governance.replay.evaluate` | CORE-21 plan readiness |
| `evaluateImportReadiness` | `governance.import.evaluate` | CORE-22 import readiness |
| `evaluateExportReadiness` | `governance.export.evaluate` | CORE-22 export readiness |
| `buildReliabilityEvidence` | `governance.evidence.build` | Evidence manifest + CORE-20 handoff |
| `createIncidentProjection` | read | Competition-scoped incidents |
| `createDegradedModeProjection` | reliability | Degraded continuation policy |
| `createCertificationReadinessProjection` | `governance.certification.read` | E2E-07 checklist |

### Success envelope

```
{ ok: true, phase, version, queryKind, capability, fingerprint, result }
```

### Errors

`GovernanceReliabilityError` with `failClosed: true` and `E2E06_*` codes.

### Projection fields (minimum)

tenant/competition identity, definition/version, publication, lifecycle, workflow, participant lock, schedule/court certification, check-in, referee, scoring, result validation, standings, qualification, final-result, archive, audit, replay, import/export, recovery, public visibility, degraded-mode, blocking issues, warnings, evidence refs, allowed/denied actions, deterministic fingerprint.

Does **not** recompute standings, winners, brackets, or schedules.
