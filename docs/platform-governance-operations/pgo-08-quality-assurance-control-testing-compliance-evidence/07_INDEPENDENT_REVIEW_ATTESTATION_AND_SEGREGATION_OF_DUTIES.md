# 07 — Independent Review, Attestation And Segregation Of Duties

## Purpose

Define independence, segregation of duties, attestation limits, and challenge/escalation requirements for control assurance.

## Independence requirements

| Role | Independence rule |
|---|---|
| Tester | Must not be the sole operator of the control under operating-effectiveness test |
| Reviewer | Must be able to challenge evidence and conclusions without reporting-line conflict for the claim being attested |
| Evidence custodian | May store evidence but does not alone attest effectiveness |
| Control owner | Accountable for objective; cannot sole-attest OE without independent review where required |
| Owner | Final GO for certification and Production-impacting assurance decisions |

## Maker-checker and segregation of duties

| Activity | Segregation expectation |
|---|---|
| Control operation vs OE testing | Separated |
| Evidence generation vs independent review | Separated |
| Remediation implementation vs retest approval | Separated where practical |
| Risk acceptance vs control operation | Acceptance authority distinct from operator for material risk |
| Compliance claim vs control operation | Legal/Owner review distinct from operator self-statement |

Conflicts of interest must be disclosed and escalate to Owner when independence cannot be achieved.

## Self-attestation limitation

Self-attestation may support preliminary documentation status (DOCUMENTED / IMPLEMENTED intent). It is insufficient alone for:

- OPERATING effectiveness certification;
- OWNER_ATTESTED consolidated control universe;
- EXTERNALLY_VERIFIED platform assurance;
- COMPLIANCE CERTIFICATION claims.

## Owner attestation

Owner attestation is required to move readiness from `NOT_READY` toward:

- `QUALITY_ASSURANCE_CONTROL_TESTING_READINESS_CERTIFIED`
- `CERTIFIED_WITH_CONDITIONS`

Owner attestation must reference evidence packages, independent review records, unresolved gaps, and residual conditions.

## External verification

External-platform assurance (GitHub branch protection, Vercel project settings, Supabase live configuration, payment/notification provider posture, and similar) remains:

```text
EXTERNAL ASSURANCE = NOT_VERIFIED
```

until Owner-approved external verification evidence exists. Repository references to external capability are not EXTERNALLY_VERIFIED proof.

## Reviewer qualification and review evidence

Review evidence must record:

- reviewer identity/role and qualification basis for the control family;
- scope reviewed;
- challenges raised and resolutions;
- residual disagreements escalated;
- attestation outcome and timestamp.

Missing challenge history is a gap for high-risk controls.

## Challenge and escalation

1. Reviewer challenges incomplete, overstated, or out-of-scope claims.
2. Unresolved challenge escalates to Control Owner, then Owner.
3. Overstated readiness vocabulary is corrected to honest status values.
4. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`** and is not opened via assurance documentation.

## Current independence posture

Independent-review evidence across the full control set is incomplete at initial PGO-08 readiness. Therefore readiness remains **`NOT_READY`**.

## Honesty status

```text
CONTROL ASSURANCE READINESS = NOT_READY
CONTROL OPERATION = NOT_VERIFIED
EXTERNAL ASSURANCE = NOT_VERIFIED
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```
