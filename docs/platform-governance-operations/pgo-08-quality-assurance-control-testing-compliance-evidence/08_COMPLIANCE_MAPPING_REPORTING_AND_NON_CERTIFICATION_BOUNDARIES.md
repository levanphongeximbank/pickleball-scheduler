# 08 — Compliance Mapping, Reporting And Non-Certification Boundaries

## Purpose

Define how internal policy, contractual, and legal/regulatory references may be mapped to controls and evidence — and state hard non-certification boundaries.

## Non-certification disclaimer

PICK_VN is **not** declared compliant with, certified under, or attested to any law, regulation, standard, or framework by this documentation.

```text
COMPLIANCE CERTIFICATION = NOT_CERTIFIED
```

Compliance mapping is a traceability aid only. Mapping ≠ compliance achievement.

## Mapping classes

| Mapping class | Allowed use | Forbidden use |
|---|---|---|
| Internal policy mapping | Link PGO controls to internal policies | Claim policy compliance without evidence |
| Contractual mapping | Note contract obligations that may need controls | Claim contract conformity without Owner/legal review |
| Legal or regulatory reference mapping | Identify potentially relevant references for Owner/legal review | Claim legal compliance or certification |

## Required mapping record fields

| Field | Requirement |
|---|---|
| Reference | Policy, contract clause, or legal/regulatory citation label (no overclaim) |
| Applicability owner | Who decides whether the reference applies |
| Related controls | Control IDs tentatively mapped |
| Evidence gap | What evidence is missing |
| Legal review dependency | Whether legal/privacy specialist review is required |
| Unresolved mapping | Explicit open questions |
| Status | Mapped-draft / applicable / not-applicable / unresolved — never “certified” without Owner-approved evidence |

## Compliance report boundaries

A compliance report produced under PGO-08 may include:

- control coverage summary with honest status vocabulary;
- evidence gaps and unresolved mappings;
- findings and risk acceptances;
- explicit `NOT_CERTIFIED` statement.

A compliance report must not include:

- statements that PICK_VN “complies with” or “is certified to” any external law/standard/framework absent approved evidence;
- secret values, PII, or Production extracts;
- implication that Notification Production Phase 2C is active.

## External assurance dependency

External assurance dependencies (providers, auditors, platform attestations) remain:

```text
EXTERNAL ASSURANCE = NOT_VERIFIED
```

until verified under Owner-approved methods.

## Unresolved mappings (initial)

| Topic | Status |
|---|---|
| Consolidated control-to-policy matrix | Unresolved — no Owner-attested universe |
| Contractual processor/subprocessor obligations | Unresolved — inherits PGO-07 `NOT_VERIFIED` |
| Legal/regulatory applicability set | Unresolved — legal review dependency open |
| Framework crosswalks (if any later requested) | Unresolved — not certified |

## Honesty status

```text
COMPLIANCE CERTIFICATION = NOT_CERTIFIED
CONTROL ASSURANCE READINESS = NOT_READY
EXTERNAL ASSURANCE = NOT_VERIFIED
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```

Legal/regulatory compliance has not been certified. Documentation and mapping do not create certification.
