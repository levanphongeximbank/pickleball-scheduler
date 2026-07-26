# 06 — Change Windows, Freezes And Emergency Change

## Control definitions

| Control | Definition | Governance effect |
|---|---|---|
| **Maintenance window** | Pre-approved period for specified operational changes | Limits scope/time and establishes staffing, communications, and verification expectations |
| **Release freeze** | Period when normal releases are paused | Only explicitly exempted or emergency changes may proceed |
| **Blackout period** | Higher-restriction interval where change risk is unacceptable | Production change is prohibited unless Owner-authorized emergency criteria are met |
| **Emergency change** | Urgent change required to contain or correct material incident/security impact | Accelerated process; evidence and retrospective obligations remain |

The change-window target is **`PROVISIONAL_NOT_CERTIFIED`** until Owner approval.

## Window record

Before an approved window, record:

1. environment, scope, change class, and risk;
2. start/end and any blackout/freeze overlap;
3. release candidate and expected deployment identity mechanism;
4. accountable operator, approvers, observers, and escalation contacts;
5. rollback/roll-forward/disablement decision criteria;
6. communication and post-deploy verification plan.

## Freeze and blackout exceptions

An exception requires explicit Owner GO, business/technical justification, risk assessment, minimum evidence, and named accountable authority. A deadline, merged PR, or green CI alone is not an exception.

## Emergency and break-glass authority

Break-glass authority:

- is limited to named authorized roles under PGO-01 and PGO-02;
- is not implied by repository or external-platform access;
- must not permit prohibited self-approval;
- must use the narrowest safe scope and duration;
- must preserve logs and avoid credential disclosure;
- requires Owner GO for Production as soon as the incident process permits;
- must not be used to reopen Notification Production Phase 2C.

## Minimum emergency evidence

1. Incident reference, severity, and impact.
2. Why the normal window/process cannot safely wait.
3. Change class, risk, exact scope, and environment.
4. Requester, executor, independent approver, and break-glass authority.
5. Candidate/artifact/deployment identities when applicable.
6. Checks completed, checks deferred, and explicit residual risk.
7. Containment/recovery option and trigger criteria.
8. Post-change result, health evidence, communications, and unresolved gaps.

## Retrospective

Every emergency change requires a dated retrospective linked to the incident. It must assess cause, decision quality, approval timing, evidence gaps, drift/reconciliation, outcome, corrective owners, and target dates. Emergency status does not exempt a change from later full review.

## Current workstream state

No maintenance window, exception, break-glass action, emergency deployment, or external operation occurred in this documentation-only run. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
