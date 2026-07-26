# 01 — Control Universe, Ownership And Assurance Authority

## Purpose

Define the control universe for PGO assurance, assign ownership roles, and state decision authority required before any control may be treated as Owner-attested.

## Control universe

The PGO-08 control universe consolidates governance controls documented across PGO-01 through PGO-07 and CI verification gates. Until the Owner attests a consolidated inventory, the universe remains incomplete and **`NOT_READY`**.

| Control family | Upstream source | Illustrative control IDs | Initial status |
|---|---|---|---|
| Registry and authority | PGO-01 | `CTL-PGO01-REG`, `CTL-PGO01-COLLISION`, `CTL-PGO01-DEFER` | DOCUMENTED; not OWNER_ATTESTED as consolidated set |
| Incident and recovery | PGO-02 | `CTL-PGO02-SEV`, `CTL-PGO02-ESC`, `CTL-PGO02-BACKUP` | DOCUMENTED; CONTROL OPERATION = NOT_VERIFIED |
| Observability and alerting | PGO-03 | `CTL-PGO03-LOG`, `CTL-PGO03-ALERT`, `CTL-PGO03-REDACT` | DOCUMENTED / partial IMPLEMENTED intent |
| Environment, config, secrets | PGO-04 | `CTL-PGO04-ENV`, `CTL-PGO04-SECRET`, `CTL-PGO04-FLAG` | DOCUMENTED; EXTERNAL ASSURANCE = NOT_VERIFIED |
| Release, deployment, change | PGO-05 | `CTL-PGO05-CLASS`, `CTL-PGO05-GATE`, `CTL-PGO05-ROLLBACK` | DOCUMENTED |
| Access and privileged admin | PGO-06 | `CTL-PGO06-ROLE`, `CTL-PGO06-REVIEW`, `CTL-PGO06-BREAKGLASS` | DOCUMENTED |
| Data protection and records | PGO-07 | `CTL-PGO07-TAX`, `CTL-PGO07-RET`, `CTL-PGO07-PROC` | DOCUMENTED; COMPLIANCE CERTIFICATION = NOT_CERTIFIED |
| CI verification gate | `.github/workflows/deploy.yml` | `CTL-CI-FOUNDATION`, `CTL-CI-LINT`, `CTL-CI-UNIT`, `CTL-CI-BUILD` | IMPLEMENTED as workflow; not OPERATING proof of Production control effectiveness |

Control identifiers above are provisional catalog labels for documentation. They are not certified inventory IDs until Owner attestation.

## Required control record fields

Every control in the attested universe must record:

| Field | Requirement |
|---|---|
| Control identifier | Stable unique ID |
| Control objective | Risk addressed and intended outcome |
| Control owner | Accountable named role/person |
| Operator | Who executes the control |
| Reviewer | Independent challenger |
| Evidence custodian | Who preserves evidence integrity |
| Risk owner | Who owns residual risk |
| Owner GO | Required for certification / Production-impacting assurance |
| Scope and system boundary | In-scope systems and explicit exclusions |
| Upstream / downstream dependency | Dependent controls and evidence consumers |
| Control status | One of DOCUMENTED / IMPLEMENTED / TESTED / OPERATING / OWNER_ATTESTED / EXTERNALLY_VERIFIED / NOT_VERIFIED |

Missing required fields block certification and keep readiness at **`NOT_READY`**.

## Assurance authority

| Decision | Authority | Notes |
|---|---|---|
| Add/remove control from universe | Control Owner + Owner GO for Production-impacting set | Provisional lists are not certified |
| Approve control objective | Control Owner | Must align with PGO domain SSOT |
| Approve test procedure / sampling / frequency | Control Owner + Reviewer; Owner GO when Production-impacting | Until approved: `PROVISIONAL_NOT_CERTIFIED` |
| Attest design effectiveness | Reviewer + Control Owner | Documentation alone is insufficient |
| Attest operating effectiveness | Reviewer + Evidence Custodian + Owner GO as required | One CI PASS is not OE certification |
| Accept residual risk | Risk Owner within delegation; otherwise Owner | Expiry and review mandatory |
| Compliance certification claim | Owner + required legal review | Absent = `NOT_CERTIFIED` |

## Scope and system boundary

In scope for PGO-08 assurance cataloging:

- repository-documented PGO controls;
- CI verification gates described in repository workflows;
- evidence packages produced under approved procedures.

Out of scope:

- Platform Core, Competition Engine, and business-module product logic as product features;
- live Production configuration unless separately Owner-attested;
- Notification Production Phase 2C (`DEFERRED_BY_OWNER`).

## Upstream and downstream dependencies

- Upstream: PGO-01 authority/registry; PGO-02..07 domain controls; CI workflow definitions.
- Downstream: findings register, remediation tracking, risk acceptance, compliance mapping, Owner certification decisions.

## Honesty status

```text
CONTROL ASSURANCE READINESS = NOT_READY
CONTROL OPERATION = NOT_VERIFIED
EXTERNAL ASSURANCE = NOT_VERIFIED
COMPLIANCE CERTIFICATION = NOT_CERTIFIED
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```

Code or docs existence does not mean a control is OPERATING. Owner attestation is required before any control may be marked OWNER_ATTESTED.
