# 06 — Findings, Exceptions, Remediation And Risk Acceptance

## Purpose

Govern how control failures, deviations, and accepted residual risks are recorded, remediated, retested, and closed.

## Definitions

| Term | Meaning |
|---|---|
| Finding | Documented control deficiency from design, implementation, or operating assessment |
| Exception | Approved temporary departure from a required control with compensating measures |
| Deviation | Unapproved departure; must be converted to finding or exception |
| Root cause | Underlying reason, not only the symptom |
| Impact | Effect on confidentiality, integrity, availability, compliance posture, or assurance claim |
| Severity rationale | Why severity was assigned; unapproved severity scales are provisional |
| Remediation owner | Named accountable owner for fix |
| Target date | Remediation deadline — provisional until approved |
| Compensating control | Temporary risk reduction while primary control is restored |
| Retest | Re-execution of approved test after remediation |
| Closure evidence | Package proving remediation and successful retest |
| Risk acceptance | Formal acceptance of residual risk with authority, expiry, and review |

## Findings register requirements

A consolidated findings and remediation register must include at least:

- finding ID and control reference;
- discovery source and timestamp;
- root cause and impact;
- severity and severity rationale;
- remediation owner and target date;
- compensating control (if any);
- status (open / remediated-pending-retest / closed / risk-accepted);
- closure evidence reference or risk-acceptance reference.

At initial PGO-08 readiness, no Owner-approved consolidated register exists → **`NOT_READY`**.

## Provisional severity and deadline labels

```text
TEST FREQUENCIES AND SAMPLE TARGETS = PROVISIONAL_NOT_CERTIFIED
```

Unapproved severity targets, SLAs, and remediation deadlines must be labeled:

```text
PROVISIONAL_NOT_CERTIFIED
```

## Remediation lifecycle

1. Record finding with incomplete-field block on certification claims.
2. Assign remediation owner and provisional target date.
3. Implement fix without expanding PGO-08 documentation scope into runtime mutation from this workstream.
4. Preserve before/after evidence references (redacted).
5. Retest using approved procedure.
6. Close only with closure evidence, or move to risk acceptance.

## Risk acceptance

Risk acceptance is valid only when:

| Field | Required |
|---|---|
| Accepted risk statement | Clear residual risk description |
| Acceptance authority | Risk Owner within delegation, otherwise Owner |
| Compensating controls | Documented if relied upon |
| Expiry | Hard expiry date |
| Review trigger | Re-review before expiry or on material change |
| Link to finding | Traceability to open deficiency |

Self-acceptance by the control operator alone is insufficient for Production-impacting residual risk.

## Closure rules

| Condition | Allowed closure type |
|---|---|
| Remediation + successful retest + custody-valid evidence | Closed |
| Accepted residual risk with authority and expiry | Risk-accepted (not “effective”) |
| Missing retest or broken evidence custody | Remain open |
| Expired risk acceptance | Re-open or re-accept; cannot silently remain closed |

## Honesty status

```text
CONTROL ASSURANCE READINESS = NOT_READY
CONTROL OPERATION = NOT_VERIFIED
COMPLIANCE CERTIFICATION = NOT_CERTIFIED
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```

Absence of an approved consolidated findings/remediation register and approved risk-acceptance evidence are explicit blockers to readiness.
