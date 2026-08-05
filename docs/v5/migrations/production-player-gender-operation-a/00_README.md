# Production Player Gender — Operation A (Hardened, Data-Only)

**Status:** PACKAGE ONLY — NOT APPLIED  
**Production GO:** NO  
**Production project (expected):** `expuvcohlcjzvrrauvud`  
**Authority:** PR #371 merge `1577785ad2190b51306c98571322871ccf9c3536`  
**Proposed package authority for future Operation A execution:** this directory

## Scope

Normalize exact Production rows where:

```text
public.profiles.gender = 'Nam'
```

to canonical:

```text
gender = 'male'
```

Expected live target count at last read-only preflight: **exactly 4**.

## Explicit exclusions

| Item | Status |
|------|--------|
| Schema CHECK on `profiles.gender` | **Excluded** — future Operation C only |
| `ALTER TABLE public.profiles` | **Excluded** |
| QA identity quarantine / ban / delete | **Excluded** — Operation B only |
| Auth user mutation | **Excluded** |
| Staging apply | **Excluded** |
| Production execution in this package pass | **Excluded** |

## File map (execution order after Owner GO)

| Step | File | Mode |
|------|------|------|
| 0 | `00_README.md` | read |
| 1 | `06_OWNER_DECISION_PACKAGE.md` | Owner decision (not GO by itself) |
| 2 | `05_OPERATOR_RUNBOOK.md` | operator procedure |
| 3 | `01_PRECHECK_SELECT_ONLY.sql` | SELECT only |
| 4 | `02_FORWARD_DATA_ONLY.sql` | transactional data update + remediation ledger |
| 5 | `03_POSTCHECK_SELECT_ONLY.sql` | SELECT only |
| emergency | `04_ROLLBACK_BY_BATCH.sql` | batch-specific rollback |

Legacy merged files under `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE*.sql` remain for history. **Do not use them for future Operation A execution.** They mix CHECK installation with data update.

## Hardening vs legacy package

1. Data normalization separated from CHECK installation.
2. Persistent batch-specific ledger with original `gender` and `updated_at`.
3. Updates only via ledger join (no broad `WHERE gender = 'Nam'` alone).
4. Exact count assertion (= 4) fail-closed.
5. Concurrent drift guards on `gender` and `updated_at`.
6. Transaction-scoped advisory lock.
7. Rollback refuses post-operation row drift.
8. Operation B fully excluded.

## Remaining Owner condition (not resolved by this package)

PITR / recoverable backup was **NOT_PROVEN** at read-only preflight. Owner must explicitly choose BLOCK or ACCEPT limited no-PITR risk before any Production execution. See `06_OWNER_DECISION_PACKAGE.md`.
