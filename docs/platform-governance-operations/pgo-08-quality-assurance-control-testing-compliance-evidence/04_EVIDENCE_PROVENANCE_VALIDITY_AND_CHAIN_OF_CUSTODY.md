# 04 — Evidence Provenance, Validity And Chain Of Custody

## Purpose

Define the schema and custody rules for control-test evidence packages. This document must not contain real data, secrets, credentials, or PII.

## Evidence package schema

Every evidence package must record:

| Field | Requirement |
|---|---|
| Evidence source | System, repository path, workflow, or human procedure that produced the artifact |
| Evidence owner | Named role accountable for authenticity |
| Generation timestamp | When the artifact was generated (UTC preferred) |
| Collection timestamp | When the artifact was collected into the package |
| Environment | local / ci / preview / staging / production (only if Owner-approved collection) |
| Scope | Systems, controls, and time window covered |
| Control reference | Control identifier(s) under test |
| Integrity | Hash, signature, or equivalent integrity method used |
| Version | Evidence schema/version and artifact version |
| Provenance | Origin chain from source to package |
| Chain of custody | Transfers, custodians, and access events |
| Retention | Retention class and target — provisional until approved |
| Expiry | When evidence becomes stale for assurance use |
| Redaction | What was redacted and why |
| Access | Who may read the package |
| Reproducibility | Whether an independent party can re-derive the conclusion from the same method |

## Validity rules

Evidence is valid for assurance use only when:

1. required schema fields are complete;
2. provenance and custody are unbroken for the claim being made;
3. environment and scope match the control boundary;
4. secrets, credentials, and PII are absent or safely redacted;
5. expiry has not passed;
6. the evidence supports the exact claim (design vs implementation vs operating effectiveness).

Invalid or incomplete evidence must be labeled non-certifying.

## Prohibited content

Evidence packages and this governance documentation must not include:

- secrets, tokens, keys, passwords, or connection strings;
- real user identifiers, contact data, or other PII;
- Production database extracts;
- raw customer or player payloads;
- unreproducible screenshots that embed sensitive values.

Use placeholders such as `[REDACTED]`, `[EVIDENCE_REF]`, and `[CONTROL_ID]`.

## Chain of custody

| Stage | Custodian duty |
|---|---|
| Generation | Record source, timestamp, environment |
| Collection | Record collector, method, and integrity check |
| Storage | Restrict access; preserve immutability where required |
| Review | Record reviewer and challenge notes |
| Transfer | Record from/to, reason, and integrity re-check |
| Disposal / archive | Follow records governance; retain disposition evidence |

Broken custody reduces evidence to informational status and blocks OWNER_ATTESTED claims that depend on it.

## Relationship to prior PGO evidence

- PGO-03 governs log redaction and observability evidence classes.
- PGO-05 governs release evidence packages.
- PGO-06 governs access/privileged-operation evidence.
- PGO-07 governs records provenance and disposal.
- PGO-08 does not replace those domain rules; it requires cross-control packages to satisfy this schema for assurance claims.

## Repository evidence vs operating evidence

| Evidence class | Example | What it can support |
|---|---|---|
| Repository documentation | PGO markdown control definitions | DOCUMENTED design intent |
| Workflow definition | CI job steps in deploy workflow | IMPLEMENTED gate design |
| CI run result | Single green verify job | Limited TESTED signal for that run only |
| Sustained OE package | Approved samples across observation window | Candidate OPERATING claim after review |
| External console attestation | Owner-approved external verification record | Candidate EXTERNALLY_VERIFIED claim |

A document existing in the repository is not an executed evidence package.

## Honesty status

```text
CONTROL ASSURANCE READINESS = NOT_READY
CONTROL OPERATION = NOT_VERIFIED
EXTERNAL ASSURANCE = NOT_VERIFIED
```

No executed evidence packages covering the full control set exist at initial PGO-08 readiness. Retention targets for assurance evidence remain **`PROVISIONAL_NOT_CERTIFIED`** until Owner approval.
