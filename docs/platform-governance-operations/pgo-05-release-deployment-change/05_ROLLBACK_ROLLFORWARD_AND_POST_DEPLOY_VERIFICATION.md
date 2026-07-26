# 05 — Rollback, Roll-Forward And Post-Deploy Verification

**Boundary:** This document defines decisions, authority, and evidence only. It contains no executable rollback, deployment, migration, feature-flag, or database command.

## Response options

| Option | Use when | Required evidence |
|---|---|---|
| **Rollback** | A known prior state is compatible and safer than retaining the new change | Incident/change reference, prior artifact/deployment identity, authority, validation result |
| **Roll-forward** | Reversal is unsafe or incompatible and a bounded corrective candidate is safer | Root cause, new immutable candidate, complete applicable gates, fallback |
| **Disablement** | Immediate containment is required and capability can be made unavailable | Affected scope, authority, state evidence, follow-up recovery decision |
| **Kill switch** | A pre-governed emergency control can contain impact | PGO-04 flag/config ownership, safe-state definition, authorization, observed result |

Disablement and kill-switch use do not prove rollback, data recovery, or incident resolution.

## Decision controls

1. Identify impact, environment, deployment identity, and data/security implications.
2. Escalate through **PGO-02** incident severity, command, recovery, and rollback authority.
3. Compare rollback, roll-forward, disablement, and containment risks.
4. Obtain Owner GO and relevant Platform Operations, Security, or Database Owner approval.
5. Execute only through authorized operational procedures outside PGO-05.
6. Capture result and perform post-deploy/post-change verification under PGO-03 evidence rules.

## Database constraints

- Schema/data compatibility can make application rollback unsafe.
- Database/schema/data correction requires Database Owner authority and explicit Production Owner GO.
- Backup availability, restore validity, migration ordering, irreversible writes, and dependent data must be assessed.
- A database rollback must not be inferred from an application rollback.
- PGO-05 neither supplies nor executes SQL, RLS, migration, restore, or data-correction operations.

## Post-deploy verification

Verification must be tied to the exact deployment identity and include, as applicable:

| Area | Evidence expectation |
|---|---|
| Deployment state | Platform-reported identity/status and intended Production environment |
| Health | PGO-03 health signals, error rates, availability, latency, and dependency status |
| Functional smoke | Critical technical journeys proportional to release scope |
| Security | Authentication/authorization and sensitive boundary checks where affected |
| Data | Migration/data integrity and reconciliation evidence where affected |
| Configuration | PGO-04 expected-state evidence without secret values |
| Observation window | Start/end, accountable observer, anomalies, final result |

Health evidence must show source, time window, environment, query/check definition, and result. “No reported issue” without evidence is not a pass.

## Failure handling and PGO-02 linkage

A failed or inconclusive check triggers containment and PGO-02 escalation. The incident record must link the release candidate, artifact/deployment identity, failed evidence, chosen recovery option, decisions, communications, and final verification. PGO-03 remains the source of truth for observability evidence.

## Current proof status

```text
ROLLBACK_OR_ROLLFORWARD_EXECUTION_PROOF: NOT_VERIFIED
POST_DEPLOYMENT_VERIFICATION_EVIDENCE: NOT_VERIFIED
VERDICT: NOT_READY
```

The rollback-time target remains **`PROVISIONAL_NOT_CERTIFIED`** until Owner approval.
