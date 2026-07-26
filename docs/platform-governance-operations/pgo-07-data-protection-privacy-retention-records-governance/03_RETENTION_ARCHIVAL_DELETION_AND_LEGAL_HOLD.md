# 03 — Retention, Archival, Deletion And Legal Hold

## Lifecycle states

`ACTIVE` → `INACTIVE` → `ARCHIVE_ELIGIBLE` → `ARCHIVED` → `DISPOSITION_REVIEW` → `DISPOSED`

A valid legal, regulatory, contractual, incident, dispute, or investigation hold changes the applicable state to `HELD` and suspends ordinary disposition until authorized release.

## Retention schedule requirements

Each data/record class requires:

- accountable Data Owner and Records Owner;
- business purpose and processing authority;
- retention trigger, duration, and authoritative system;
- archive conditions, format, location class, and access boundary;
- dependencies across live stores, logs, analytics, backups, replicas, snapshots, caches, exports, and temporary copies;
- hold applicability and conflict precedence;
- approved disposal method and evidence;
- review cadence and jurisdiction/contract assessment.

No duration in repository documentation is a certified Production target unless the Owner and required specialists approve it. Existing PGO-03 log targets remain **`PROVISIONAL_NOT_CERTIFIED`**.

## Archival governance

Archive is a controlled lifecycle state, not indefinite retention. Archived records must retain provenance, integrity evidence, classification, owner, access restrictions, retention trigger, hold state, and disposal date or review trigger. Searchability and access should be reduced to the minimum needed for the approved archival purpose.

## Deletion and secure disposal

Disposition requires an authorized request or an approved schedule, scope validation, hold check, dependency inventory, independent approval where sensitive, financial, audit, or Production records are involved, and completion evidence. Secure disposal must address recoverable copies according to provider capability and documented lifecycle limits.

Deletion from the primary store does not establish disposal from:

- provider-managed backups or recovery windows;
- replicas, snapshots, queues, caches, or search indexes;
- logs, audit trails, analytics stores, exports, attachments, or local copies;
- downstream processors and subprocessors.

Residual copies must be documented with access restrictions and final expiry behavior.

## Legal hold

Only designated legal/compliance authority with the Data Owner and Owner may issue or release a hold. The hold record must identify scope, authority reference, start time, custodians, affected systems/copies, access restrictions, review cadence, and release evidence without embedding restricted case content unnecessarily.

No operator may silently override a hold. Conflicting routine deletion is suspended, and the exception is recorded.

## Evidence honesty

PGO-02 documents backup/restore authority and PGO-03 documents provisional log retention. Neither proves current provider settings, successful disposition, complete copy discovery, or active legal-hold tooling. No live lifecycle action was performed for PGO-07.

## Certification gaps

- approved enterprise retention schedule;
- complete data/copy inventory and dependency map;
- legal-hold authority and tested workflow;
- provider deletion and backup-expiry attestations;
- disposal evidence schema and completed samples;
- reconciliation between subject deletion and mandatory records retention.

```text
TARGETS: PROVISIONAL_NOT_CERTIFIED
DATA_READINESS: NOT_READY
LEGAL_COMPLIANCE: NOT_CERTIFIED
```
