# Operation B1B — Dedicated QA Quarantine Remediation Plan

**Status:** PLANNING ONLY — NOT IMPLEMENTED  
**Operation ID:** `OPERATION_B1B_DEDICATED_QA_QUARANTINE_REMEDIATION`  
**Base origin/main SHA:** `3c6c3f0261c843f992e21499569b7df51525ed5d`  
**Planning branch:** `plan/operation-b1b-dedicated-qa-quarantine-remediation`

## Incident summary

Operation B1 attempted to set `public.profiles.status = 'quarantined'` for exactly eight certified QA identities. Production rejected the first profile write through `profiles_status_check` (`active | suspended | invited` only).

| Counter | Value |
|---------|-------|
| Successful Production mutations | **0** |
| Auth ban attempts | **0** |
| Profile mutations retained | **0** |
| Compensation required | **No** — fail-closed before any durable change |

All eight authorized QA identities remain in their original profile and Auth state.

## Retired authority (permanently non-reusable)

| Artifact | Value | Reusable |
|----------|-------|----------|
| Owner GO | `APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY` | **NO** |
| Batch ID | `b37186cf-e620-4f27-aba3-d7e8750ae7df` | **NO** |

```text
OLD_OWNER_GO_REUSABLE=NO
OLD_BATCH_REUSABLE=NO
PRODUCTION_GO=NO
EXECUTION_AUTHORIZED=NO
```

## Selected canonical design

**C2 — Dedicated authority table `public.qa_identity_quarantines`**

- Leaves `profiles.status` and `profiles_status_check` unchanged.
- Separates QA quarantine from real-user account lifecycle (`active` / `suspended` / `invited`).
- Binds exact `profile_id` + `auth_user_id`, batch correlation, actor, reason, release state, and rollback snapshots.
- Does **not** reuse `suspended` and does **not** extend the status CHECK.

Decision record: `03_OPTION_C_DECISION_RECORD.md`.

## Scope boundaries

**In scope (planning):**

- Root-cause classification
- Canonical data model and Option C decision
- Forward migration / rollback plans (non-executable)
- RLS / writer / authority model
- Runtime filter migration map
- Runner remediation plan
- Real-constraint test plan
- Staging rehearsal and fresh authorization protocol
- Controlled work packages

**Out of scope (this task):**

- Runtime source changes
- Executable SQL / migrations
- Staging or Production access or mutation
- Auth reads/writes
- New Owner GO or new execution batch
- Retained preflight worktree / allowlist / recovery snapshot changes
- Deploy, push, PR

## Document index

| # | File | Purpose |
|---|------|---------|
| 00 | `00_README.md` | This index and governance snapshot |
| 01 | `01_ROOT_CAUSE_AND_INCIDENT_CLASSIFICATION.md` | Failure sequence and disposition |
| 02 | `02_CANONICAL_QA_QUARANTINE_DATA_MODEL.md` | Selected data model |
| 03 | `03_OPTION_C_DECISION_RECORD.md` | C1 / C2 / C3 evaluation |
| 04 | `04_FORWARD_MIGRATION_PLAN.md` | Future migration sequence (planning) |
| 05 | `05_ROLLBACK_AND_RECOVERY_PLAN.md` | Rollback and recovery |
| 06 | `06_RLS_WRITER_AND_AUTHORITY_MODEL.md` | Authority boundaries |
| 07 | `07_RUNTIME_AND_FILTER_MIGRATION_MAP.md` | Consumer inventory and migration |
| 08 | `08_RUNNER_REMEDIATION_PLAN.md` | Future B1B runner behavior |
| 09 | `09_TEST_AND_REAL_CONSTRAINT_COVERAGE_PLAN.md` | Test requirements |
| 10 | `10_STAGING_REHEARSAL_AND_ACCEPTANCE_GATES.md` | Staging gates |
| 11 | `11_FRESH_AUTHORIZATION_AND_EXECUTION_PROTOCOL.md` | Fresh GO protocol |
| 12 | `12_IMPLEMENTATION_WORK_PACKAGES.md` | WP1–WP8 |
| — | `OPERATION_B1B_REMEDIATION_PLAN.json` | Machine-readable plan |

## Implementation authorization

```text
IMPLEMENTATION_AUTHORIZED=NO
PRODUCTION_GO=NO
EXECUTION_AUTHORIZED=NO
STAGING_MUTATIONS=0
PRODUCTION_MUTATIONS=0
```

No future Operation B1 / B1B Production execution is authorized by this planning package. Fresh implementation merge, independent review, Staging rehearsal, fresh allowlist/snapshot hashes, new batch UUID, and a **new** exact Production Owner GO are all required (see `11_FRESH_AUTHORIZATION_AND_EXECUTION_PROTOCOL.md`).
