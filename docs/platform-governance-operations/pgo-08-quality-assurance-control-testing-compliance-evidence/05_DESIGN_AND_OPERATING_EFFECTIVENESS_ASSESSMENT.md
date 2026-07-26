# 05 — Design And Operating Effectiveness Assessment

## Purpose

Define how design effectiveness, implementation verification, and operating effectiveness are assessed, and set explicit certification boundaries.

## Assessment types

| Assessment | Question answered | Minimum evidence |
|---|---|---|
| Design effectiveness | If operated as designed, would the control meet its objective? | Control design record, dependency map, failure-mode analysis, reviewer challenge |
| Implementation verification | Does the intended control exist in the approved scope? | Repository/workflow/config references without secret values; gap list |
| Operating effectiveness | Did the control operate as designed throughout the observation period? | Approved samples, exception rate, sustained-operation evidence, independent review |

## Hard non-inference rules

1. Code exists ≠ control is OPERATING.
2. Test exists ≠ test was executed.
3. One CI PASS ≠ sustained operating effectiveness.
4. Documentation exists ≠ control is certified.
5. External capability ≠ external configuration is EXTERNALLY_VERIFIED.
6. Compliance mapping ≠ legal certification.

## Observation period and sampling

Operating-effectiveness conclusions require:

- an Owner-approved observation period;
- an approved population and sample (otherwise `PROVISIONAL_NOT_CERTIFIED`);
- recorded sample results and exception rate;
- evaluation of control dependencies and compensating controls;
- evidence that operation was sustained, not a one-off demonstration.

Until those exist, **`CONTROL OPERATION = NOT_VERIFIED`**.

## Result classification

| Result | Meaning | Certification effect |
|---|---|---|
| Design effective | Design can meet objective if operated | Necessary but not sufficient for readiness |
| Implemented | Control artifacts exist in scope | Necessary but not sufficient |
| Operating effective | Sampled operation met criteria across period | Required for OE claims; still needs Owner attestation path |
| Partial evidence | Some but not all required evidence present | Cannot certify OE |
| Ineffective | Design or operation fails objective | Finding required; remediation or risk acceptance |
| Not tested | No approved executed test | Remains NOT_VERIFIED |

## Exception rate and dependency

- Exception rate must be computed against the defined population/sample, not anecdotes.
- A dependent control that is ineffective can invalidate downstream OE conclusions.
- Partial green CI history cannot be extrapolated to untested control families.

## Certification boundary

PGO-08 may document assessment criteria and record gaps. It may not declare:

- `QUALITY_ASSURANCE_CONTROL_TESTING_READINESS_CERTIFIED`
- `CERTIFIED_WITH_CONDITIONS`

without Owner-attested evidence packages, independent review, and explicit residual-condition handling.

Initial verdict remains:

```text
CONTROL ASSURANCE READINESS = NOT_READY
CONTROL OPERATION = NOT_VERIFIED
EXTERNAL ASSURANCE = NOT_VERIFIED
COMPLIANCE CERTIFICATION = NOT_CERTIFIED
```

## Current repository snapshot (read-only)

| Area | Design | Implementation signal | Operating effectiveness |
|---|---|---|---|
| PGO-01..07 governance docs | Present as DOCUMENTED designs | Docs merged historically | NOT_VERIFIED |
| CI Production CI Gate | Designed as verification-only | Workflow IMPLEMENTED | Single/multiple green runs ≠ OE certification |
| External platforms | Authority matrices documented | Capability referenced | NOT_VERIFIED / not EXTERNALLY_VERIFIED |
| Notification Phase 2C | Deferred track recorded | N/A | `DEFERRED_BY_OWNER` |

## Honesty status

```text
CONTROL ASSURANCE READINESS = NOT_READY
TEST FREQUENCIES AND SAMPLE TARGETS = PROVISIONAL_NOT_CERTIFIED
CONTROL OPERATION = NOT_VERIFIED
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```
