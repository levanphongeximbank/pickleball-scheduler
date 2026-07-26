# 03 — Test Planning, Procedures, Sampling And Frequency

## Purpose

Define how control tests are planned, sampled, executed, and evidenced. All frequencies, sample sizes, and deadlines in this document are provisional until Owner approval.

## Mandatory provisional label

```text
TEST FREQUENCIES AND SAMPLE TARGETS = PROVISIONAL_NOT_CERTIFIED
```

No frequency, sample size, SLA, or deadline in this file is certified.

## Test plan structure

Each control test plan must include:

| Field | Requirement |
|---|---|
| Test objective | Which control objective is being evaluated (design and/or operating effectiveness) |
| Procedure | Step-by-step method; environment; tools; prohibited actions |
| Population | Full set of relevant control occurrences in the observation window |
| Sample | Selected items from the population |
| Sampling rationale | Why the sample is representative or risk-based |
| Frequency | How often the test runs — provisional until Owner approval |
| Tester independence | Tester must not be sole operator of the control under test |
| Expected result | Observable pass criteria |
| Deviation handling | How exceptions are recorded and escalated |
| Retest | Conditions and evidence required after remediation |
| Completion evidence | Package references satisfying provenance rules in doc 04 |

## Procedure principles

1. Prefer read-only evidence collection for Production-adjacent controls.
2. Do not access Production consoles, databases, secrets, or PII to “complete” a sample.
3. Do not treat a single CI green result as a completed operating-effectiveness test for the observation period.
4. Document environment (`local` / `ci` / `preview` / `staging` / `production-evidence-only-if-Owner-approved`).
5. Record whether the test evaluated design, implementation, or operating effectiveness.

## Provisional sampling model (not certified)

| Control class | Provisional population idea | Provisional sample idea | Status |
|---|---|---|---|
| Automated CI gates | All pipeline runs in observation window | Risk-based subset of PR and main runs | `PROVISIONAL_NOT_CERTIFIED` |
| Change/release approvals | All in-scope changes in window | Sample by risk class (high/medium/low) | `PROVISIONAL_NOT_CERTIFIED` |
| Access reviews | All privileged accounts in inventory | Sample of joiner/mover/leaver and break-glass events | `PROVISIONAL_NOT_CERTIFIED` |
| Retention/disposal | All record classes with retention targets | Sample of classes with hold/disposal events | `PROVISIONAL_NOT_CERTIFIED` |
| Incident response | All severity-qualified incidents | All Sev1/Sev2; sample lower severities | `PROVISIONAL_NOT_CERTIFIED` |

Exact sample sizes and windows require Owner approval before use as certification evidence.

## Provisional frequency model (not certified)

| Activity | Provisional cadence | Status |
|---|---|---|
| Design-effectiveness review for changed controls | Per material change | `PROVISIONAL_NOT_CERTIFIED` |
| Operating-effectiveness testing | Periodic per control family | `PROVISIONAL_NOT_CERTIFIED` |
| Evidence package integrity review | Periodic | `PROVISIONAL_NOT_CERTIFIED` |
| Findings aging review | Periodic | `PROVISIONAL_NOT_CERTIFIED` |
| Risk-acceptance expiry review | Before acceptance expiry | `PROVISIONAL_NOT_CERTIFIED` |

## Tester independence

- The operator of a control should not be the sole tester of that control’s operating effectiveness.
- Self-attestation is limited evidence and cannot alone support Owner certification.
- External verification, where required, remains **`NOT_VERIFIED`** until obtained.

## Deviation, retest, and completion

| Event | Required action |
|---|---|
| Deviation from expected result | Open finding/exception; assess impact and severity rationale |
| Remediation completed | Retest using approved procedure; retain before/after evidence references |
| Incomplete sample | Do not mark control TESTED or OPERATING; record gap |
| Unapproved procedure used | Evidence is non-certifying until procedure approved |

## Honesty status

```text
TEST FREQUENCIES AND SAMPLE TARGETS = PROVISIONAL_NOT_CERTIFIED
CONTROL ASSURANCE READINESS = NOT_READY
CONTROL OPERATION = NOT_VERIFIED
```

There is no approved control-test schedule and no approved sampling model at initial PGO-08 readiness.
