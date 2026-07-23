# CORE-02 Phase 1B — Implementation

**Status:** Capability-local (dormant). No production cutover.  
**Version:** `CORE02_ROLE_PERMISSION_VERSION` = `core02-role-permission-1.0.0`  
**Module:** `src/features/competition-core/role-permission/`

## Deliverables

| Area | Path |
|------|------|
| Enums | `enums/` — roles, permissions, actions, deny reasons |
| Contracts | `contracts/` — subject, scope, request, decision, evidence, explanation |
| Ports | `ports/identityEvidencePort.js` |
| Services | `mapActionToPermissions`, `evaluateAuthorization` |
| Adapters | Identity projection; Team / Lineup port wrappers; Match / Workflow projectors |
| Errors | `AUTHORIZATION_ERROR_CODE` + `AuthorizationError` |
| Tests | `tests/competition-core-role-permission-core02-phase1b-*.test.js` |
| Phase CI | `scripts/ci/unit-test-files.phase-core02-1b.json` |

## Public import

```js
import {
  evaluateAuthorization,
  createTeamAuthorizationPortAdapter,
  createLineupAuthorizationPortAdapter,
  projectToMatchAuthorizationDecision,
  projectToTransitionAuthorizationDecision,
} from "../src/features/competition-core/role-permission/index.js";
```

Do **not** import from root `competition-core/index.js` in Phase 1B (not registered).

## Action → permission (Phase 1B minimum)

### Team (`TEAM_ROSTER_AUTH_ACTION`)

| Action | Required permissions (any-of) |
|--------|-------------------------------|
| `TEAM_ROSTER_UNLOCK` | `team.manage` |
| `TEAM_WITHDRAW` | `team.withdraw` |
| `TEAM_ACTIVATE` | `team.manage` |
| `ROSTER_LOCK` | `team.manage` |

### Lineup (`LINEUP_AUTH_ACTION`)

| Action | Required permissions (any-of) |
|--------|-------------------------------|
| `LINEUP_DRAFT` | `team.lineup.submit`, `team_lineup.update_before_lock` |
| `LINEUP_SUBMIT` | `team.lineup.submit`, `team_lineup.submit` |
| `LINEUP_LOCK` | `team.lineup.lock`, `team_lineup.lock` |
| `LINEUP_PUBLISH` | `team.lineup.publish` |
| `LINEUP_OVERRIDE` | `team.lineup.override` |
| `LINEUP_VOID` | `team.lineup.submit`, `team_lineup.update_before_lock` |
| `LINEUP_VIEW_OWN` | `team.view`, `team_lineup.view` |
| `LINEUP_VIEW_OPPONENT` | `team_lineup.view`, `tournament.view` |

Permission **string values** align with Identity `PERMISSIONS` — CORE-02 does not fork the catalog SoT.

## Fail-closed evaluate path

1. Validate request shape (subject, scope with `competitionId`, action).
2. Map action → permissions; unmapped → `UNKNOWN_ACTION`.
3. Require evidence port + evidence; missing → `EVIDENCE_UNAVAILABLE`.
4. Scope mismatch (tenant/venue/competition) → `SCOPE_MISMATCH`.
5. No granted permission intersection → `PERMISSION_DENIED`.
6. Else allow with explanation.

## Production safety

| Gate | Status |
|------|--------|
| Root barrel export | NOT performed |
| Main CI manifest | NOT performed (phase manifest only) |
| Identity SoT / SQL / UI | Untouched |
| Team / Lineup / Match / Workflow cores | Untouched |
| Feature flags / cutover | Unchanged |
| CORE-12 | Untouched |

## Out of scope (deferred)

- Captain “own team only” relational checks beyond scope fields
- LineupVisibilityPort
- Production Identity wiring / live `rbac.can`
- Integrator barrel + official CI promotion
