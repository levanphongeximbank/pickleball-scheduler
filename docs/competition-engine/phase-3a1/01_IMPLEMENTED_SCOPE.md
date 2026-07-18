# 01 — Implemented Scope

## In scope (delivered)

| Item | Path |
|------|------|
| Runtime modes + transitions | `runtime-control/contracts/runtimeModes.js` |
| Execution context | `runtime-control/contracts/executionContext.js` |
| Feature flag snapshot | `runtime-control/contracts/featureFlagSnapshot.js` |
| Runtime overrides | `runtime-control/contracts/runtimeOverrides.js` |
| Diagnostics | `runtime-control/contracts/decisionDiagnostics.js` |
| Audit events | `runtime-control/contracts/auditEvents.js` |
| Runtime decision | `runtime-control/contracts/runtimeDecision.js` |
| Kill-switch resolver | `runtime-control/resolvers/resolveKillSwitch.js` |
| Precedence / mode resolver | `runtime-control/resolvers/resolveFlagPrecedence.js` |
| Decision resolver | `runtime-control/resolvers/resolveRuntimeDecision.js` |
| Validation | `runtime-control/validation/*` |
| Constants / reason codes | `runtime-control/constants/*` |
| Public barrel | `runtime-control/index.js` + core `index.js` |
| Official tests | `tests/competition-core-runtime-control-3a1*.test.js` |
| Manifest registration | `scripts/ci/unit-test-files.json` |

## Out of scope (not delivered — intentional)

```text
Canonical / legacy executor dispatch
Shadow execution hooks
Env / remote-config loaders
Supabase / SQL / persistence
UI / admin panel
Production feature flag enablement
Phase 3A.2 shadow infrastructure wiring
Phase 3B participant runtime
```
