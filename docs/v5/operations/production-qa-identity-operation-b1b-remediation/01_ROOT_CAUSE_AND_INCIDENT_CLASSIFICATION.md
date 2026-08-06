# 01 — Root Cause and Incident Classification

**Operation:** B1 → B1B remediation planning  
**Production mutations:** 0  
**Classification:** `SCHEMA_CONTRACT_MISMATCH_FAIL_CLOSED_NO_COMPENSATION`

## Exact failure sequence

1. Preflight classified exactly eight identities as `SAFE_FOR_REVERSIBLE_QUARANTINE` (QA-04…QA-11).
2. Owner GO `APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY` and batch `b37186cf-e620-4f27-aba3-d7e8750ae7df` authorized live execution under the B1A runner.
3. Runner engine ordered mutations as:
   - (a) `profiles.status = 'quarantined'` via `updateProfileStatus`
   - (b) Auth admin ban (`ban_duration = 876000h`) only after profile success
4. **First attempted write:** conditional UPDATE on `public.profiles` setting `status = 'quarantined'` for the first allowlisted profile.
5. PostgreSQL rejected the write via **`profiles_status_check`** (allowed values: `active | suspended | invited`).
6. Engine abort path: profile failure ⇒ Auth ban **skipped** (`skipped_after_profile_failure`).
7. Batch fail-closed: stop after first unresolved live failure.
8. Result: **zero successful profile mutations**, **zero Auth ban attempts**, all eight identities unchanged.

## First attempted write

| Field | Value |
|-------|-------|
| Target table | `public.profiles` |
| Mutation | `UPDATE … SET status = 'quarantined'` |
| Writer path | B1A live adapter `updateProfileStatus` (service-role) |
| Constraint | `profiles_status_check` |
| Outcome | Rejected |

## CHECK rejection

Committed canonical RBAC schema (`docs/supabase-rbac.sql`) defines:

```text
status text not null default 'active'
  check (status in ('active', 'suspended', 'invited'))
```

Staging and Production both enforce this contract. No committed migration added `quarantined` to `profiles_status_check`.

## Zero successful mutations — why no compensation

Compensation in the B1 engine restores profile status only after a **successful** quarantine write when a later Auth ban fails. Because the first write never succeeded:

- No profile row entered a non-original state
- No Auth ban was attempted
- No partial dual-write split existed
- Compensation was correctly unnecessary

```text
PRODUCTION_MUTATIONS=0
AUTH_MUTATIONS=0
PROFILE_MUTATIONS=0
COMPENSATION_REQUIRED=NO
```

## Package assumptions vs schema contract

| Assumption in B1 package | Actual schema / evidence |
|--------------------------|--------------------------|
| `quarantined` is an existing canonical `profiles.status` value | False — CHECK excludes it |
| “No schema change” is safe for quarantine | False for `status='quarantined'` |
| Unit tests prove Production-safe writes | False — adapters mocked; CHECK never exercised |
| Profile-then-ban ordering is recoverable | Only after a successful illegal write — which DB forbids |
| Soft flag / meta path already durable | Runtime hooks only (`meta.qaQuarantined`, boolean `quarantined`); no durable DB quarantine authority |

Primary sources of the false assumption:

- `scripts/operations/production-qa-identity-operation-b1/lib/constants.js` — `QUARANTINE_PROFILE_STATUS = "quarantined"`
- `scripts/operations/production-qa-identity-operation-b1/lib/quarantineEngine.js` — profile status mutation first
- `docs/v5/operations/production-qa-identity-operation-b1/00_README.md` — documents status quarantine as canonical
- `docs/v5/migrations/PRODUCTION_TEST_IDENTITY_QUARANTINE_PLAN.sql` — planning note suggesting `status = 'quarantined'`
- Runtime filter `qaTestIdentityFilter.js` already accepts `status === 'quarantined'` and `meta.qaQuarantined` as **read** signals without a DB writer that can set them legally via `status`

## Test coverage failure

| Gap | Effect |
|-----|--------|
| Unit tests mock `updateProfileStatus` | Never hit real Postgres CHECK |
| No integration test against Staging CHECK | False green on package tests |
| No schema assertion that `quarantined ∈ profiles_status_check` | Assumption never verified |
| Adapter tests assert UPDATE shape, not constraint acceptance | Production rejection unpredicted |

## Incident severity and classification

| Dimension | Rating |
|-----------|--------|
| Data integrity impact | **None** (zero mutations) |
| Availability impact | **None** |
| Security / privilege escalation | **None** |
| Process / governance severity | **High** — authorized Production mutation path based on false schema assumption |
| Customer / real-user impact | **None** |
| Classification | `P2_PROCESS_SCHEMA_MISMATCH` with `FAIL_CLOSED_SUCCESS` |
| Disposition | Retire GO + batch; remediate via dedicated QA quarantine authority (B1B) |

This is **not** a Production data corruption incident. It is a **blocked unauthorized-by-schema write** under an Owner GO that must never be reused.

## Governance disposition of old GO and batch

| Item | Disposition |
|------|-------------|
| `OWNER_GO=APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY` | **Permanently retired** — `OLD_OWNER_GO_REUSABLE=NO` |
| `BATCH_ID=b37186cf-e620-4f27-aba3-d7e8750ae7df` | **Permanently retired** — `OLD_BATCH_REUSABLE=NO` |
| Prior retired unused batch `9c9d5fc7-648e-44c6-a959-e62157f7c970` | Remains retired |
| Future execution | Requires **new** implementation, **new** artifacts, **new** batch UUID, **new** Owner GO |

Any attempt to reuse the retired GO or batch for Production mutation is a governance violation and must fail closed.
