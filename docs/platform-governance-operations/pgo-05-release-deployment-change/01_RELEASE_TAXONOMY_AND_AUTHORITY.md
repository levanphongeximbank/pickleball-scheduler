# 01 — Release Taxonomy And Authority

## Controlled vocabulary

| Term | Governance definition | Required authority/evidence |
|---|---|---|
| **Change** | Any proposed alteration to tracked documentation, source, dependency, configuration, feature flag, database, data, infrastructure, or platform state. | Classification, risk, scope, reviewer, and approval record. |
| **Release** | An approved, identifiable set of changes declared eligible for delivery. A merge alone is not a release. | Immutable commit, included changes, gate results, release authority. |
| **Release candidate** | A specifically identified commit/artifact under evaluation before a release verdict. | Candidate identity, test evidence, open risks, supersession status. |
| **Deployment** | Placement of an identified artifact or change into an identified environment. | Artifact identity, environment, deployment identity, operator/automation, result. |
| **Promotion** | Advancing the same approved artifact between separated environments without rebuilding or silently altering it. | Source/target environment, artifact match, approval, promotion result. |
| **Activation** | Making deployed capability effective for intended users or traffic. Deployment and activation may be separate events. | Activation authority, scope, time, configuration/flag evidence under PGO-04. |
| **Rollback** | Restoring a previously known state or deployment after a failed or harmful change. | PGO-02 decision record, prior identity, Owner GO where required, validation result. |
| **Roll-forward** | Correcting failure by delivering a newer approved change when rollback is unsafe or unsuitable. | Root cause, new candidate identity, gates, authority, fallback plan. |
| **Disablement** | Containing impact by making a capability unavailable without claiming restoration. | Scope, reason, authority, current state, follow-up decision. |
| **Hotfix** | Urgent, narrowly scoped change using accelerated review while retaining evidence and approval obligations. | Incident/change reference, risk, independent review, break-glass approval, retrospective. |

## Distinctions that must remain explicit

1. Change approval is not release approval.
2. Release approval is not deployment evidence.
3. Deployment is not activation unless evidence shows both occurred.
4. Promotion must preserve artifact identity; rebuilding creates a new artifact.
5. Disablement is containment, not proof of rollback or recovery.
6. Green CI does not prove Production deployment.
7. A merged PR does not prove a Production release.
8. Preview deployment is not Production deployment.

## Authority boundaries

| Decision | Minimum governance authority |
|---|---|
| Propose and classify a change | Contributor; independent reviewer confirms material classification |
| Approve module scope/readiness | Module Owner, subject to risk escalation |
| Approve shared platform or Production-affecting change | Platform Operations and **Owner GO** |
| Approve security-sensitive change | Security plus Owner GO for Production |
| Approve database/schema/data operation | Database Owner plus Owner GO for Production |
| Declare release candidate | Designated release authority with traceable candidate identity |
| Promote, activate, disable, rollback, or roll forward Production | Authorized operator/domain owner plus explicit Owner GO |
| Emergency break-glass action | Named break-glass authority; no self-approval; retrospective required |
| Certify PGO-05 readiness | Owner after all checklist evidence is complete |

No role may infer authority from technical access alone. External-platform access is capability, not approval. PGO-01 controls the authority baseline; PGO-02 controls incident/recovery escalation; PGO-03 controls operational evidence; PGO-04 controls environment/configuration/secret mutations.

## Current workstream boundary

PGO-05 creates policy documentation only. It does not create a release candidate, deploy, promote, activate, disable, roll back, or roll forward any environment.
