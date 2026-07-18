# Phase 3A.2 — Shadow Infrastructure

```text
Phase 3A.2 creates infrastructure only.
Shadow remains disabled.
No real executor dispatch exists.
Legacy remains Production primary.
```

## Status

| Item | Value |
|------|-------|
| Phase | 3A.2 |
| Branch | `feature/competition-engine-phase-3a2-shadow-infrastructure` |
| Base | Phase 3A.1 merge `18216d4` |
| Production wiring | **NONE** |
| Feature flags | **OFF** (unchanged) |
| Shadow runtime | **OFF** |
| Database | **UNCHANGED** |

## What this phase builds

- Shadow execution request contract
- Eligibility resolver (default `eligible: false`)
- Execution plan model (primary + return source always `LEGACY`)
- Result envelope (fixture / injected results)
- Comparison framework (`EQUIVALENT` … `SKIPPED`)
- Normalization boundary (generic, no domain hard-coding)
- Structured difference model
- Stable reason codes
- Diagnostics (pure data)
- Audit-event factories (no persist/publish)
- Report summarizer
- Unit + architecture tests
- Documentation

## What this phase does **not** do

- Call Legacy or Canonical executors
- Wire Production request paths
- Enable feature flags
- Persist diagnostics or audit events
- Start Phase 3B / runtime cutover / legacy retirement

## Module location

```text
src/features/competition-core/runtime-control/shadow/
```

## Docs in this folder

| File | Topic |
|------|-------|
| `architecture.md` | Boundaries and strangler placement |
| `contracts.md` | Request / envelope / plan contracts |
| `eligibility.md` | Eligibility rules |
| `comparison-model.md` | Statuses, differences, normalization |
| `diagnostics.md` | Diagnostics + audit factories |
| `safety-invariants.md` | Production-safe defaults |
| `testing.md` | Test inventory |
| `owner-review-checklist.md` | Owner GO checklist |
