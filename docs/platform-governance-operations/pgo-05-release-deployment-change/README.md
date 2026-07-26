# PGO-05 — Release, Deployment & Change Governance

**Workstream:** PGO-05 — RELEASE, DEPLOYMENT & CHANGE GOVERNANCE
**Scope:** Documentation only
**Owner GO:** GRANTED for documentation implementation and path-only validation
**Branch:** `feature/pgo-05-release-deployment-change-governance`
**Fresh baseline:** `66b57ddeaa7c9bc805c0dca06f45e34e3588fb45`

## Purpose

PGO-05 defines the governance model for classifying, approving, releasing, deploying, promoting, activating, disabling, rolling back, and rolling forward changes. It establishes evidence and authority requirements without changing runtime behavior.

## Documentation-only scope

| In scope | Out of scope |
|---|---|
| Taxonomy, risk, approvals, readiness gates | Source code, CI, package, lockfile, SQL, RLS, or migration changes |
| Artifact and deployment identity policy | Deploying or promoting any environment |
| Rollback/roll-forward decision policy | Executing rollback, roll-forward, disablement, or kill switches |
| Change windows, freezes, emergency governance | Changing flags, environment variables, secrets, or platform configuration |
| Evidence package and authority matrix | Accessing external platform consoles or APIs |
| Readiness checklist and honest initial verdict | Creating releases, tags, commits, pushes, or pull requests |

This workstream does not deploy, mutate runtime state, or certify Production based on documentation alone.

## Ownership boundary and source-of-truth relationships

- **PGO-01** remains the source of truth for registry, collision, deferred-track, and authority baselines.
- **PGO-02** remains the source of truth for incident response, recovery, and rollback escalation.
- **PGO-03** remains the source of truth for observability, health evidence, and post-deployment evidence.
- **PGO-04** remains the source of truth for environments, configuration, feature flags, and secrets.
- **PGO-05** owns release/deployment/change policy, evidence composition, and readiness verdicts only.
- Product and business rules remain outside PGO.

## Mandatory evidence honesty

- Green CI does not prove that Production was deployed.
- A merged PR does not prove a Production release.
- A Preview deployment is not a Production deployment.
- External-platform capability does not prove that it is configured.
- Repository evidence does not prove external-console state.
- Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.

## Initial snapshot

```text
VERDICT: NOT_READY
EXTERNAL_PLATFORM_EVIDENCE: NOT_VERIFIED
NOTIFICATION_PRODUCTION_PHASE_2C: DEFERRED_BY_OWNER
```

Unapproved change-window, rollback-time, approval-SLA, and evidence-retention targets are **`PROVISIONAL_NOT_CERTIFIED`**.

## Table of contents

1. [Release taxonomy and authority](./01_RELEASE_TAXONOMY_AND_AUTHORITY.md)
2. [Change classification, risk, and approval](./02_CHANGE_CLASSIFICATION_RISK_AND_APPROVAL.md)
3. [Release readiness and gate model](./03_RELEASE_READINESS_AND_GATE_MODEL.md)
4. [Deployment pipeline, promotion, and artifact integrity](./04_DEPLOYMENT_PIPELINE_PROMOTION_AND_ARTIFACT_INTEGRITY.md)
5. [Rollback, roll-forward, and post-deploy verification](./05_ROLLBACK_ROLLFORWARD_AND_POST_DEPLOY_VERIFICATION.md)
6. [Change windows, freezes, and emergency change](./06_CHANGE_WINDOWS_FREEZES_AND_EMERGENCY_CHANGE.md)
7. [Release evidence, audit trail, and attestation](./07_RELEASE_EVIDENCE_AUDIT_TRAIL_AND_ATTESTATION.md)
8. [External-platform deployment authority matrix](./08_EXTERNAL_PLATFORM_DEPLOYMENT_AUTHORITY_MATRIX.md)
9. [PGO-05 readiness and certification checklist](./09_PGO_05_READINESS_AND_CERTIFICATION_CHECKLIST.md)
