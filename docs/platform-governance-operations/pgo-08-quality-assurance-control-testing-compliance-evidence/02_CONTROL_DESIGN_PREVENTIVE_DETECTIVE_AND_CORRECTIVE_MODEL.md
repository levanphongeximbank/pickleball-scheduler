# 02 — Control Design: Preventive, Detective And Corrective Model

## Purpose

Define how PGO controls are designed across preventive, detective, and corrective modes, including manual/automated/hybrid execution, failure modes, escalation, and compensating controls.

## Control modes

| Mode | Intent | Examples from repository evidence | Honest status |
|---|---|---|---|
| Preventive | Stop unauthorized or unsafe action before it occurs | Path-only workstream rules; Foundation Lock; lint no-new gate; change-classification/approval policy; role/SoD policy; secrets classification | DOCUMENTED / partial IMPLEMENTED in CI; Production operating state NOT_VERIFIED |
| Detective | Detect deviation, failure, or unauthorized activity | Observability/alerting taxonomy; audit-logging policy; access-review cadence (provisional); CI unit/build failure signals | DOCUMENTED; sustained detection OPERATING not attested |
| Corrective | Restore safe state and preserve learning | Incident response/escalation; rollback/roll-forward policy; remediation and retest requirements; break-glass timeout/revocation policy | DOCUMENTED; execution evidence NOT_VERIFIED |

## Execution classes

| Class | Definition | Constraint |
|---|---|---|
| Manual | Human performs procedure and records evidence | Requires independence rules and maker-checker where mandated |
| Automated | Machine-enforced gate or check | Workflow presence ≠ sustained operating effectiveness |
| Hybrid | Automation plus human decision/attestation | Human attestation cannot be replaced by a single green CI run |

## Design record requirements

Every control design must document:

| Element | Description |
|---|---|
| Design intent | What risk is reduced and how |
| Trigger | Event, schedule, or condition that starts the control |
| Input | Approved inputs only; no secrets/PII in evidence packs |
| Execution | Steps, tools, environments, and operators |
| Output | Expected evidence artifact and success criteria |
| Failure mode | How the control fails open/closed and detectable symptoms |
| Escalation | Who is notified and under what severity |
| Compensating control | Temporary alternative when primary control is impaired |
| Control dependency | Upstream controls required for this control to be effective |

## Illustrative design mappings (non-certified)

| Control ID (provisional) | Mode | Class | Trigger | Failure mode |
|---|---|---|---|---|
| `CTL-CI-FOUNDATION` | Preventive | Automated | PR/push to main | Build/gate fail; merge should be blocked if required checks enforced externally — external branch protection NOT_VERIFIED |
| `CTL-CI-UNIT` | Detective | Automated | PR/push to main | Test failure; does not itself prove Production health |
| `CTL-PGO05-GATE` | Preventive / Detective | Hybrid | Release readiness review | Incomplete evidence package blocks Owner GO |
| `CTL-PGO06-BREAKGLASS` | Corrective / Preventive | Hybrid | Emergency privileged need | Missing dual control or timeout → finding |
| `CTL-PGO07-RET` | Preventive | Manual / Hybrid | Retention schedule event | Unapproved retention target remains `PROVISIONAL_NOT_CERTIFIED` |
| `CTL-PGO03-ALERT` | Detective | Hybrid | Threshold / error class | Alert routing gaps → detective control ineffective |

These mappings are design documentation only. They are not OPERATING or OWNER_ATTESTED claims.

## Compensating controls

Compensating controls may be used only when:

1. primary control impairment is recorded as a finding or exception;
2. residual risk owner and expiry are named;
3. retest of the primary control is scheduled;
4. Owner GO is obtained when Production-impacting.

An undocumented workaround is a deviation, not a compensating control.

## Escalation

Escalation follows the owning PGO domain (incident, access, release, data) and ultimately Owner GO for certification-impacting decisions. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`** and must not be opened by this workstream.

## Honesty status

```text
CONTROL OPERATION = NOT_VERIFIED
TEST FREQUENCIES AND SAMPLE TARGETS = PROVISIONAL_NOT_CERTIFIED
EXTERNAL ASSURANCE = NOT_VERIFIED
CONTROL ASSURANCE READINESS = NOT_READY
```

Implemented code or CI configuration is design/implementation evidence only. It does not certify that the control is operating effectively over time.
