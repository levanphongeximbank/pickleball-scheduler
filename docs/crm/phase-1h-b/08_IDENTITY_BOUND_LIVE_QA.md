# 08 — Identity-Bound Live QA

**Phase:** CRM Phase 1H-B
**Staging project ref:** `qyewbxjsiiyufanzcjcq`
**Production MCP / Production credentials:** not used
**Owner authorization:** live identity-bound QA approved
**Marker `CRM_STAGING_QA_IDENTITIES_READY`:** true
**Runner:** `scripts/crm/phase-1h-b-identity-bound-live-qa.mjs`
**Role matrix order 8:** not applied (**DEFERRED**)
**CRM role-matrix rows:** **0** (**PASS**)
**Durable runtime:** **OFF** (**PASS**)

## Certification disposition

Covered by **COMPLETE WITH DOCUMENTED LIMITATIONS** (see `12_PHASE_1H_B_FINAL_CERTIFICATION.md`).

## Explicit marks

| Item | Class |
|------|-------|
| STAFF | **WAIVED** |
| CUSTOMER | **WAIVED** |
| QA_ADMIN | **UNAVAILABLE** / not tested |
| non-admin permission-positive coverage | **PARTIAL** |
| claim/release positive path | **BLOCKED** (pending CRM grants or admin fixture) |
| role matrix | **DEFERRED** (0 rows) |
| durable runtime | **OFF** |
| Production used | no |
| deploy / workers | no |
| secrets printed | no |

## Pre-run gates

| Gate | Result |
|------|--------|
| Project ref exactly `qyewbxjsiiyufanzcjcq` | **PASS** |
| `CRM_STAGING_QA_IDENTITIES_READY=true` | **PASS** |
| Mandatory aliases resolve | **PASS** |
| Role-matrix rows = 0 | **PASS** |
| Durable runtime OFF | **PASS** |
| Production MCP unused | **PASS** |
| Role matrix SQL not applied | **PASS** |
| No user create / password reset / permission grant | **PASS** |

## Live results

| # | Test | Class | Notes |
|---|------|-------|-------|
| 1 | Authorized same-scope positive operation | **PARTIAL** | No CRM grants; `QA_ADMIN` unavailable |
| 2 | Second same-scope identity | **PASS** | Second session same-scope Operator A |
| 3 | Unauthorized identity denied | **PASS** | |
| 4 | Cross-tenant isolation | **PASS** | |
| 5 | Cross-venue isolation | **PASS** | |
| 6 | Claim RPC positive path | **BLOCKED** | Requires CRM grant or admin |
| 7 | Double-claim prevention | **BLOCKED** | Depends on claim positive path |
| 8 | Release own claim | **BLOCKED** | Depends on claim positive path |
| 9 | Cross-identity release denied | **PASS** | |
| 10 | Consent mutation guard | **PASS** | |
| 11 | Immutable consent/audit fields | **PASS** | |
| 12 | Identity-derived tenant/venue scope | **PASS** | |
| 13 | Client-supplied scope escalation blocked | **PASS** | |
| 14 | Role matrix remains absent | **PASS** | 0 rows |
| 15 | Durable runtime remains OFF | **PASS** | |
| 16 | No worker/provider execution | **PASS** | |
| 17 | No Production connection/write | **PASS** | |

## What this proves / does not prove

**Proves:** staging identity denial, tenant/venue isolation, consent immutability, scope non-escalation, runtime safety, seed-only matrix absence.

**Does not prove:** full non-admin permission-positive CRM paths; claim/release positive + concurrency under CRM grants; STAFF/CUSTOMER coverage; role-matrix rollout.

## Cleanup

QA-tagged fixtures cleaned after run. Evidence uses aliases only (no emails, passwords, JWTs, UUIDs, keys, or connection strings).
