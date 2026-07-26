# 03 — Release Readiness And Gate Model

## Gate model

A release candidate receives a readiness verdict only after every applicable gate has evidence. “Not applicable” requires a reason and accountable reviewer; silence is not a pass.

| Gate | Required evidence | Blocking conditions |
|---|---|---|
| **Scope** | Exact change set, owner, class, risk, affected environments | Scope drift, mixed unreviewed changes, unresolved collision |
| **Tests** | Relevant automated/manual results tied to candidate | Failed, skipped without rationale, or candidate mismatch |
| **Lint** | Repository-required lint result | New unresolved errors or missing evidence |
| **Build** | Reproducible successful build for candidate where applicable | Failure, unknown inputs, or artifact not tied to build |
| **Foundation lock** | Required architecture/foundation lock result | Lock failure or unauthorized baseline change |
| **Security** | Threat/security review proportional to risk; vulnerability findings disposition | Critical unresolved issue or missing required reviewer |
| **Package/lockfile** | Declared dependency delta, lockfile consistency, provenance review | Unexplained lockfile drift or unreviewed dependency |
| **Migration** | Ordered plan, compatibility, Database Owner approval, backup/recovery evidence | Unsafe sequencing, missing owner, no recovery path |
| **Rollback/roll-forward** | Chosen fallback, applicability constraints, responsible authority | No viable recovery decision or unowned execution |
| **Documentation** | Release notes/operator/user docs proportional to change | Operationally material gap |
| **Approvals** | Independent review and all role/Owner approvals | Self-approval, expired/scope-mismatched approval |
| **CI** | CI run identity and status tied to immutable candidate | Missing/failed run or different commit |

Documentation-only changes mark runtime gates “not applicable” only with explicit scope proof. This does not certify any Production deployment.

## Gate ordering

1. Freeze candidate scope and identity.
2. Classify change and risk.
3. Collect applicable technical and governance evidence.
4. Resolve blockers or create explicit Owner-accepted conditions.
5. Issue one readiness verdict.
6. If candidate content changes, invalidate affected evidence and reassess.

## Readiness verdict vocabulary

| Verdict | Meaning |
|---|---|
| `RELEASE_DEPLOYMENT_CHANGE_READINESS_CERTIFIED` | All applicable evidence is complete and Owner certifies readiness for the explicitly identified scope. |
| `CERTIFIED_WITH_CONDITIONS` | Owner accepts named conditions with owner, deadline, and bounded impact; no hidden critical blocker. |
| `NOT_READY` | Required evidence, approval, integrity, recovery, deployment, or verification proof is missing or failed. |
| `DEFERRED_BY_OWNER` | Owner intentionally postpones a specific track; it is not certified. |

## Evidence interpretation rules

- Green CI proves only the recorded checks for the recorded candidate.
- A merged PR does not prove Production release or deployment.
- A Preview deployment does not prove Production deployment.
- Repository deployment configuration does not prove external-console configuration.
- Release readiness does not equal successful post-deployment verification.

## Initial PGO-05 verdict

```text
VERDICT: NOT_READY
```

Missing evidence includes verified Production deployment, environment promotion, artifact-integrity attestation, rollback/roll-forward execution proof, post-deployment verification, external-console evidence, and Owner Production approval.
