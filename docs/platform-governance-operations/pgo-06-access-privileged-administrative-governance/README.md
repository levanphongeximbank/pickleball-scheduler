# PGO-06 — Access Review, Privileged Operations & Administrative Governance

**Workstream:** PGO-06 — ACCESS, PRIVILEGED OPERATIONS & ADMINISTRATIVE GOVERNANCE
**Scope:** Documentation only
**Owner GO:** GRANTED for documentation implementation and path-only validation
**Branch:** `feature/pgo-06-access-privileged-admin-governance`
**Fresh baseline:** `0c55f0814aeae1c470c65204b72e6dba0aad9f80`

## Purpose

PGO-06 defines the governance model for identity taxonomy, role privilege and segregation of duties, access request/approval/provisioning/removal, periodic access review and recertification, privileged operations and break-glass, administrative session governance, service accounts and machine identities, and external-platform access authority. It establishes evidence and authority requirements without changing runtime access or Production entitlements.

## Documentation-only scope

| In scope | Out of scope |
|---|---|
| Access taxonomy, ownership, and authority definitions | Changing roles, permissions, or Production access |
| Role privilege and segregation-of-duties policy | Creating, modifying, or deleting accounts |
| Access request, approval, provisioning, and removal policy | Executing joiner/mover/leaver or revocation actions |
| Periodic access review and recertification model | Performing or certifying a live access review |
| Privileged operations, break-glass, and dual-control policy | Executing break-glass or temporary elevation |
| Administrative action and session governance | Mutating administrative sessions or Production config |
| Service-account and machine-identity custody policy | Reading, writing, rotating, or using real credentials |
| External-platform access authority matrix | Accessing GitHub/Vercel/Netlify/Supabase consoles or APIs |
| Readiness checklist and honest initial verdict | Changing CI, package, lockfile, SQL, RLS, src, api, or secrets |

This workstream does not alter access, deploy, migrate, rotate secrets, or certify Production based on documentation alone.

## Ownership boundary and source-of-truth relationships

- **PGO-01** remains the source of truth for ownership, registry, collision, deferred-track, and authority baselines.
- **PGO-02** remains the source of truth for incident response, emergency authority, and recovery escalation.
- **PGO-03** remains the source of truth for logging, correlation, security audit evidence, and retention/redaction policy.
- **PGO-04** remains the source of truth for environments, configuration, and secret custody.
- **PGO-05** remains the source of truth for change approval and administrative change evidence.
- **PGO-06** owns access/privileged-admin policy, evidence composition, and readiness verdicts only.
- Product and business rules remain outside PGO.

## Mandatory evidence honesty

- Role names in source do not prove that Production access is currently granted.
- Service-role capability does not prove that a credential was used.
- External-platform capability does not prove that a console is configured or access is attested.
- Audit-log code paths do not prove that a privileged operation occurred in Production.
- Repository evidence is not external-console verification.
- Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.

## Initial snapshot

```text
VERDICT: NOT_READY
EXTERNAL_PLATFORM_EVIDENCE: NOT_VERIFIED
NOTIFICATION_PRODUCTION_PHASE_2C: DEFERRED_BY_OWNER
```

Unapproved access-review cadence, revocation SLA, temporary-elevation duration, break-glass timeout, and access-evidence retention targets are **`PROVISIONAL_NOT_CERTIFIED`**.

## Table of contents

1. [Access taxonomy, ownership, and authority](./01_ACCESS_TAXONOMY_OWNERSHIP_AND_AUTHORITY.md)
2. [Role privilege and segregation of duties](./02_ROLE_PRIVILEGE_AND_SEGREGATION_OF_DUTIES.md)
3. [Access request, approval, provisioning, and removal](./03_ACCESS_REQUEST_APPROVAL_PROVISIONING_AND_REMOVAL.md)
4. [Periodic access review and recertification](./04_PERIODIC_ACCESS_REVIEW_AND_RECERTIFICATION.md)
5. [Privileged operations, break-glass, and dual control](./05_PRIVILEGED_OPERATIONS_BREAK_GLASS_AND_DUAL_CONTROL.md)
6. [Administrative action and session governance](./06_ADMINISTRATIVE_ACTION_AND_SESSION_GOVERNANCE.md)
7. [Service accounts, machine identities, and credential custody](./07_SERVICE_ACCOUNTS_MACHINE_IDENTITIES_AND_CREDENTIAL_CUSTODY.md)
8. [External-platform access authority matrix](./08_EXTERNAL_PLATFORM_ACCESS_AUTHORITY_MATRIX.md)
9. [PGO-06 readiness and certification checklist](./09_PGO_06_READINESS_AND_CERTIFICATION_CHECKLIST.md)
