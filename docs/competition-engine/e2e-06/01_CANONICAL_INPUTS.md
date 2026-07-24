# E2E-06 — Canonical Inputs

## Competition Engine (E2E-01→05)

| Symbol | Import |
|--------|--------|
| `createCompetitionRuntimePorts` | `competition-engine/integration` |
| `authorizeCompetitionAction` | runtime ports / composition |
| `createOrganizerOperationsFacade` | consume only |
| `createPlayerCompetitionOperationsFacade` | consume only |
| `createRefereeCompetitionOperationsFacade` | consume only |
| `createPublicCompetitionExperienceFacade` | consume only |
| `buildPublicCompetitionExperienceSections` | consume only |

## Competition Core

| Capability | Canonical import | Root? |
|------------|------------------|-------|
| CORE-19 Workflow | `competition-core/workflow` | No (capability-local) |
| CORE-20 Audit | `competition-core/audit` | No |
| CORE-21 Replay | `competition-core/deterministic-seed-replay` | No |
| CORE-22 Import/Export | `competition-core/import-export` | Partial |
| CORE-23 Recovery | `competition-core/recovery-resume` | Partial |

## Competition Management

| Capability | Canonical import |
|------------|------------------|
| CM-06 Publication | `competition-management/competition-publication` |
| CM-07 Suspension/Cancellation | `competition-management/competition-suspension-cancellation` |
| CM-08 Archive | `competition-management/competition-archive` |

## Platform

| Surface | Rule |
|---------|------|
| `src/core/platform` contracts | Reuse identity/trace shapes only; do not edit Platform Core |
| Platform Governance & Operations | Do **not** duplicate incident/recovery product; competition incident projection is scoped handoff only |

## Identity

| Surface | Rule |
|---------|------|
| `PERMISSIONS` | Map governance actions onto existing Identity permissions |
| Evidence port | Via E2E-01 `identityEvidencePort`; never trust `grantedPermissions` |
