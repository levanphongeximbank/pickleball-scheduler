# CRM — Scope Reconciliation (+ BM-FINAL-SAFETY-01)

**Module:** CRM  
**Module classification:** `STRUCTURAL_FOUNDATION_COMPLETE`  
**Safety containment:** CLOSED (`BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PASS`, PR #308)  
**crmSafetyClosed:** `true`

## Layer distinctions

| Layer | Status |
|-------|--------|
| Canonical implementation (1B–1F domain/services) | Present |
| Durable persistence (partial) | Tag / TagAssignment / Consent / PendingEvent SQL + adapters only |
| Durable runtime enablement | **OFF** (memory default; Production durable blocked) |
| Live provider / notification delivery | Deferred |
| Role matrix expansion (order 8) | Deferred — 0 CRM `role_permissions` on Staging |
| Production rollout | Deferred / blocked |

Only items truly outside locked implementation/safety scope are deferred below.

## Why not `FULLY_COMPLETED_CLOSED`

1. Durable runtime remains guarded OFF.  
2. Role-matrix order 8 unapplied.  
3. Lead / Opportunity / Interaction / Task SQL never entered Phase 1G table set (scoped deferral).  
4. Claim/release positive QA blocked without matrix / QA_ADMIN.

Safety incident containment is closed separately and must not be confused with full CRM product closure.

## BM-FINAL-SAFETY-01 evidence (required)

| Requirement | Evidence |
|-------------|----------|
| One-time authorization | `src/features/crm/staging/phase1hBOneTimeAuthorization.js` + `docs/crm/bm-final-safety-01/APPLY_AUTHORIZATION_GUARD.md` |
| Replay protection | Replay → typed rejection; 0 DB writes (`TEST_CERTIFICATION.md`, `SANITIZED_REAPPLY_EVIDENCE.json`) |
| Terminal Production block | Production ref `expuvcohlcjzvrrauvud` terminal in `phase1hBGates.js` |
| Staging least-privilege remediation | 5 `REVOKE`, 1 tx, 0 rows / 0 schema / 0 migrations / 0 role-matrix |
| Post-merge verification | PR [#308](https://github.com/levanphongeximbank/pickleball-scheduler/pull/308) merge `7866e775` + this pack |
| Cleanup | Incident original evidence intentionally uncommitted; package committed; residual risks documented |

Package root: `docs/crm/bm-final-safety-01/`  
Status marker: `BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PASS`

### Staging re-apply containment

| Field | Value |
|-------|-------|
| Drift verdict | `CRM_STAGING_REAPPLY_POLICY_OR_GRANT_DRIFT_FOUND` |
| Remediation verdict | `BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PASS` |
| Containment | **CLOSED** via package + PR #308 |

## Canonical surfaces

| Dimension | Path / authority |
|-----------|------------------|
| Canonical source | `src/features/crm/` |
| Public facade | `src/features/crm/index.js` |
| Ownership | Relationship lifecycle (lead/opp/interaction/task/tag/consent/pending) |
| Runtime guard | `persistence/runtimeCompositionGuard.js` |
| Auth | Fail-closed `authorizeCrm` + SQL RLS/RPC |
| Platform Core | `platform/crmPlatformAdapter.js` |
| Ports | Repo contracts + cross-module ports |

## Tests (targeted)

- `tests/crm-phase-1b-foundation.test.js`
- `tests/crm-phase-1h-staging-readiness.test.js`
- `tests/crm-phase-1h-b-staging-apply.test.js`
- `tests/crm-bm-final-safety-01-apply-authorization.test.js`
- `tests/crm-bm-final-safety-01-canonical-hash.test.js`

## localStorage / mock

Canonical repos are memory/durable adapters — not LS. Legacy campaign/template shells may use LS compat only (`COMPATIBILITY.md`).

## Deferred gates

- `CRM_ROLE_MATRIX_ORDER_8_APPLY`
- `CRM_DURABLE_RUNTIME_ENABLEMENT`
- `CRM_LEAD_OPP_INTERACTION_TASK_SQL`
- `CRM_PRODUCTION_ROLLOUT`
- `CRM_PROVIDER_NOTIFICATION_WIRING`
- Residual intentional UPDATE grants (documented in `RESIDUAL_RISK_AND_OWNER_DECISION.md`)

## Incident evidence (untouched)

Original file at main checkout is **not** copied/committed/modified by this workstream:

`C:\Users\Le Phong\pickleball-scheduler\docs\crm\phase-1h-b\APPLY_RESULT.json`  
SHA256 `AA68D276A2E357101AD164E3B6038F30ECEB7C24B46A4FF66A10026EB78767A5`

## Verdict

CRM locked foundation + safety containment are reconciled. Module remains `STRUCTURAL_FOUNDATION_COMPLETE`.  
No domain remediation required in BM-FINAL-GAPS-02.
