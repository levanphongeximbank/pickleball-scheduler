# PGO-08 — Quality Assurance, Control Testing & Compliance Evidence Governance

**Scope:** Documentation only  
**Branch:** `feature/pgo-08-quality-assurance-control-testing-compliance-evidence-governance`

## Purpose

PGO-08 defines repository-level governance for the control universe, control design model, test planning and sampling, evidence provenance and chain of custody, design and operating effectiveness assessment, findings and risk acceptance, independent review and segregation of duties, and compliance mapping with explicit non-certification boundaries. It establishes assurance and evidence requirements; it does not execute control tests, certify operating effectiveness, or claim legal compliance.

## Scope boundary

In scope:

- control-universe and ownership definitions;
- preventive, detective, and corrective control design model;
- provisional test procedures, sampling, and frequency frameworks;
- evidence schema, provenance, and custody requirements;
- design-effectiveness and operating-effectiveness assessment criteria;
- findings, exceptions, remediation, and risk-acceptance governance;
- independent-review and segregation-of-duties requirements;
- compliance mapping and non-certification disclaimers;
- readiness and certification checklist.

Out of scope:

- access to Production, databases, external consoles, or provider APIs;
- executing control tests against live systems;
- any SQL, migration, deploy, backup, restore, or runtime mutation;
- changes to `.github/**`, `scripts/**`, packages, lockfiles, `src/**`, `api/**`, `supabase/**`, environments, or PGO-01 through PGO-07 content;
- opening Notification Production Phase 2C;
- claiming legal, regulatory, or framework certification.

Repository evidence from PGO-01 through PGO-07 and CI workflows proves design intent and documentation status only. It does not prove sustained operating effectiveness, external configuration, or compliance certification.

## Mandatory honesty snapshot

```text
CONTROL ASSURANCE READINESS = NOT_READY
TEST FREQUENCIES AND SAMPLE TARGETS = PROVISIONAL_NOT_CERTIFIED
CONTROL OPERATION = NOT_VERIFIED
EXTERNAL ASSURANCE = NOT_VERIFIED
COMPLIANCE CERTIFICATION = NOT_CERTIFIED
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```

## Certification vocabulary

| Value | Meaning |
|---|---|
| `QUALITY_ASSURANCE_CONTROL_TESTING_READINESS_CERTIFIED` | Owner-attested readiness after approved evidence packages and independent review |
| `CERTIFIED_WITH_CONDITIONS` | Owner-attested readiness with explicitly recorded residual conditions |
| `NOT_READY` | One or more required assurance elements are missing or unverified |
| `DEFERRED_BY_OWNER` | Owner intentionally postpones a named track; no readiness is implied |

## Ownership boundary

- The **Control Owner** is accountable for control objective, design, and residual risk.
- The **Operator** executes the control and produces operational evidence without acquiring Owner GO authority.
- The **Reviewer** challenges design and operating evidence independently of the operator.
- The **Evidence Custodian** preserves integrity, provenance, retention, and access of evidence packages.
- The **Risk Owner** accepts or rejects residual risk within Owner-approved authority.
- The **Owner** provides required GO for certification, Production-impacting assurance decisions, and risk acceptance beyond delegated authority.
- PGO-01 through PGO-07 remain authoritative for registry, incident, observability, configuration/secrets, release/change, access/privileged admin, and data-protection domains.

## Read-only evidence audit summary

Evidence reviewed without Production access, database queries, or secret inspection includes:

| Domain | Repository evidence class | Honest status |
|---|---|---|
| PGO-01 registry, authority, CI/CD authority | DOCUMENTED | NOT_VERIFIED for live branch protection / external console |
| PGO-02 incident and recovery | DOCUMENTED | CONTROL OPERATION = NOT_VERIFIED |
| PGO-03 observability and logging | DOCUMENTED / partial IMPLEMENTED intent | OPERATING effectiveness not attested |
| PGO-04 environment, config, secrets | DOCUMENTED | EXTERNAL ASSURANCE = NOT_VERIFIED |
| PGO-05 release, deployment, change | DOCUMENTED | One green CI ≠ operating effectiveness |
| PGO-06 access and privileged admin | DOCUMENTED | OWNER_ATTESTED inventory missing |
| PGO-07 data protection and records | DOCUMENTED | COMPLIANCE CERTIFICATION = NOT_CERTIFIED |
| GitHub Actions `Production CI Gate` | IMPLEMENTED as verification workflow | TESTED only when CI runs; not sustained OE proof |
| External platforms (Vercel, Supabase, GitHub, payment, notification) | Capability referenced in docs | EXTERNALLY_VERIFIED = false; NOT_VERIFIED |

Status vocabulary used in this workstream: **DOCUMENTED**, **IMPLEMENTED**, **TESTED**, **OPERATING**, **OWNER_ATTESTED**, **EXTERNALLY_VERIFIED**, **NOT_VERIFIED**.

## Why initial readiness is NOT_READY

- no Owner-attested consolidated control universe;
- no approved control-test schedule;
- no approved sampling model;
- no executed evidence packages for the full control set;
- no sustained operating-effectiveness evidence;
- no complete independent-review evidence;
- no consolidated findings and remediation register;
- no approved risk-acceptance evidence;
- external-platform assurance not verified;
- legal/regulatory compliance not certified.

## Contents

1. [Control universe, ownership, and assurance authority](./01_CONTROL_UNIVERSE_OWNERSHIP_AND_ASSURANCE_AUTHORITY.md)
2. [Control design — preventive, detective, and corrective model](./02_CONTROL_DESIGN_PREVENTIVE_DETECTIVE_AND_CORRECTIVE_MODEL.md)
3. [Test planning, procedures, sampling, and frequency](./03_TEST_PLANNING_PROCEDURES_SAMPLING_AND_FREQUENCY.md)
4. [Evidence provenance, validity, and chain of custody](./04_EVIDENCE_PROVENANCE_VALIDITY_AND_CHAIN_OF_CUSTODY.md)
5. [Design and operating effectiveness assessment](./05_DESIGN_AND_OPERATING_EFFECTIVENESS_ASSESSMENT.md)
6. [Findings, exceptions, remediation, and risk acceptance](./06_FINDINGS_EXCEPTIONS_REMEDIATION_AND_RISK_ACCEPTANCE.md)
7. [Independent review, attestation, and segregation of duties](./07_INDEPENDENT_REVIEW_ATTESTATION_AND_SEGREGATION_OF_DUTIES.md)
8. [Compliance mapping, reporting, and non-certification boundaries](./08_COMPLIANCE_MAPPING_REPORTING_AND_NON_CERTIFICATION_BOUNDARIES.md)
9. [PGO-08 readiness and certification checklist](./09_PGO_08_READINESS_AND_CERTIFICATION_CHECKLIST.md)
