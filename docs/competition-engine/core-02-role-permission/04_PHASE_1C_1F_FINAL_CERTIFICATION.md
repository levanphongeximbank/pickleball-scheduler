# CORE-02 Phase 1C–1F — Final Certification

**Verdict:** Ready for controlled commit/push  
**Capability status:** `CERTIFIED_CAPABILITY_LOCAL_DORMANT`  
**Version:** `core02-role-permission-1.0.0`  
**Date:** 2026-07-23

## Scope consolidated

Phases 1C–1F are consolidated into this finalization package (no production wiring):

| Phase | Focus | Result |
|-------|-------|--------|
| 1C | Contract certification | PASS |
| 1D | Fail-closed certification | PASS |
| 1E | Consumer compatibility | PASS |
| 1F | Docs + tests + commit/push readiness | PASS |

## Test evidence (pre-commit)

| Suite | Result |
|-------|--------|
| CORE-02 phase manifest | **44/44 PASS** |
| Team roster `core05` | **18/18 PASS** |
| Lineup `core06-phase1c` | **17/17 PASS** |
| Match lifecycle `core15-phase1b` | **17/17 PASS** |
| Workflow adapters + control `core19` | **67/67 PASS** |
| Architecture lock | **OK** |
| `node --check` on module JS | **OK** |

## Remediation in finalization

- Denied `AuthorizationDecision` can no longer retain `decisionCode: "ALLOW"`.
- Added fail-closed coverage: adapter exception, malformed subject, indeterminate evidence, RBAC-flag independence, projector deny hardening.

## Explicit statements

- **Owner CORE-02** = Competition Role & Permission Adapter
- Historical `docs/competition-engine/core-02/` + `participants/` = Owner **CORE-03** Participant & Entry (alias drift)
- Identity remains platform permission/role SoT
- CORE-02 is an adapter/facade — not a duplicate RBAC system
- Fail-closed independent of `VITE_RBAC_ENABLED`
- Capability-local dormant; root barrel + main CI deferred
- CORE-12 unchanged
- Known permission alias debt: `team.lineup.*` vs `team_lineup.*` (explicit any-of mapping)

## Deferred (Integrator / later)

- Root `competition-core/index.js` export
- Main `scripts/ci/unit-test-files.json` promotion
- Production Identity evidence wiring
- Captain relational “own team only” beyond scope fields
- LineupVisibilityPort
