# 05 — Backup, Restore, Replica And Data-Copy Governance

## Copy taxonomy

| Copy class | Governance concern |
|---|---|
| Provider-managed backup | Vendor capability, plan, retention, encryption, access, recovery, expiry |
| Logical backup/export | Scope, purpose, approver, storage, integrity, retention, disposal |
| Replica | Read/access boundary, consistency, region, failover, independent retention |
| Snapshot | Point-in-time scope, creator, environment, retention, restoration authority |
| Cache/index | Derived fields, invalidation, access, subject-request propagation |
| Queue/retry payload | Minimum payload, visibility, retry/dead-letter retention |
| Temporary working copy | Purpose, named custodian, location class, expiry, disposal evidence |
| Local/offline copy | Device/user boundary, encryption, sync, revocation, stale-data handling |

## Required copy register

Every copy mechanism needs an owner, source, destination, environment, data classes, purpose, creation trigger, authorized roles, encryption expectations, region, processor, retention/expiry, hold behavior, subject-request behavior, recovery use, and disposal evidence.

Unregistered copies are not authorized for Production data.

## Environment boundary

Copying Production data into Development, Test, Preview, Demo, training, personal devices, or other non-Production environments is prohibited. Non-Production must use synthetic data or fixtures created without Production-derived personal, tenant, financial, authentication, or sensitive values.

Masking alone does not authorize a Production copy. Any exceptional proposal requires documented necessity, legal/security review, Data Owner approval, Owner GO, bounded fields, isolated access, expiry, and evidence; no exception is established by this workstream.

## Recovery governance

Backup existence, restore capability, and recovery readiness are separate claims. PGO-02 states that repository checklists and references do not prove a current backup, PITR setting, or successful restore. A recovery action requires approved authority, source evidence, target/environment validation, access controls, integrity checks, post-action validation, and residual-copy reconciliation.

PGO-07 performed no real backup, restore, replica, snapshot, export, or migration operation.

## Subject requests, holds, and copies

- Deletion from an active system must record how protected backups age out and prevent unauthorized reintroduction.
- A restored dataset must reapply subsequent approved corrections, restrictions, deletions, and hold decisions before normal use.
- Legal hold applies consistently to identified copies while minimizing new duplication.
- Temporary incident or support copies require explicit expiry and disposal evidence.

## Current evidence and gaps

Repository evidence includes PGO-02 backup/restore authority, module backup gates, offline/mobile queues, cloud-sync concepts, and provider configuration references. It does not verify live backup schedules, regions, replica topology, snapshot inventory, temporary copies, provider expiry, or recovery drills.

```text
DATA_READINESS: NOT_READY
TARGETS: PROVISIONAL_NOT_CERTIFIED
EXTERNAL_PROCESSORS: NOT_VERIFIED
```
