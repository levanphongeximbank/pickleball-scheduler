# PGO-07 — Data Protection, Privacy, Retention & Records Governance

**Scope:** Documentation only  
**Branch:** `feature/pgo-07-data-protection-privacy-retention-records-governance`

## Purpose

PGO-07 defines repository-level governance for data classification, ownership, processing authority, privacy limits, retention, subject requests, copies, processors, logs, records evidence, and disposal. It establishes decision and evidence requirements; it does not operate on data or certify legal compliance.

## Scope boundary

In scope:

- governance definitions and evidence requirements;
- repository evidence paths and unresolved gaps;
- provisional lifecycle targets for Owner review;
- readiness and certification criteria.

Out of scope:

- access to databases, Production data, external consoles, or provider APIs;
- processing a live subject request;
- any real export, deletion, backup, restore, snapshot, migration, or deployment;
- changes to runtime code, SQL/RLS, environments, CI, packages, or earlier PGO workstreams.

Repository evidence proves design intent only. It does not prove live configuration, provider terms, retention execution, disposal, or legal compliance.

## Mandatory honesty snapshot

```text
DATA_READINESS: NOT_READY
TARGETS: PROVISIONAL_NOT_CERTIFIED
EXTERNAL_PROCESSORS: NOT_VERIFIED
LEGAL_COMPLIANCE: NOT_CERTIFIED
NOTIFICATION_PHASE_2C: DEFERRED_BY_OWNER
```

## Ownership boundary

- The **Data Owner** approves purpose, lawful/authorized processing basis, access, retention, subject-request outcomes, and disposal.
- The **Data Custodian** implements approved safeguards and preserves evidence without acquiring business authority.
- A **Processor** acts only under documented instructions and an approved processing boundary.
- The **Records Owner** defines record value, provenance, hold, archive, and disposal authorization.
- The **Owner** provides required GO for Production-impacting or certification decisions.
- PGO-01 through PGO-06 remain authoritative for their existing ownership, incident, observability, configuration, release, and access domains.

## Repository evidence snapshot

Evidence reviewed without accessing real data includes player privacy contracts and fail-closed projections, tenant and role boundaries, identity and billing audit designs, notification/payment integrations, PGO-02 backup authority, PGO-03 log redaction/retention, and PGO-06 external-platform authority. These are partial controls, not an organization-wide processing inventory.

## Contents

1. [Data taxonomy, ownership, and processing authority](./01_DATA_TAXONOMY_OWNERSHIP_AND_PROCESSING_AUTHORITY.md)
2. [Privacy purpose, minimization, and processing limits](./02_PRIVACY_PURPOSE_MINIMIZATION_AND_PROCESSING_LIMITS.md)
3. [Retention, archival, deletion, and legal hold](./03_RETENTION_ARCHIVAL_DELETION_AND_LEGAL_HOLD.md)
4. [Data subject request, export, and portability](./04_DATA_SUBJECT_REQUEST_EXPORT_AND_PORTABILITY.md)
5. [Backup, restore, replica, and data-copy governance](./05_BACKUP_RESTORE_REPLICA_AND_DATA_COPY_GOVERNANCE.md)
6. [External processor, sharing, and cross-platform data](./06_EXTERNAL_PROCESSOR_SHARING_AND_CROSS_PLATFORM_DATA.md)
7. [Log, audit, analytics, and non-Production data](./07_LOG_AUDIT_ANALYTICS_AND_NON_PRODUCTION_DATA.md)
8. [Records evidence chain and disposal governance](./08_RECORDS_EVIDENCE_CHAIN_AND_DISPOSAL_GOVERNANCE.md)
9. [PGO-07 readiness and certification checklist](./09_PGO_07_READINESS_AND_CERTIFICATION_CHECKLIST.md)
