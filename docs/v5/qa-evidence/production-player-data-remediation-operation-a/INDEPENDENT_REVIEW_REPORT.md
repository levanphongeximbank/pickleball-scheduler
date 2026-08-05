# Independent Review — Operation A Hardened Package

**Reviewer role:** separate defect-first review of local package diff  
**Scope:** `docs/v5/migrations/production-player-gender-operation-a/**`, package tests, evidence  
**Production GO:** NO  
**Review time:** after implementation + validation  

## Answers

| # | Question | Answer | Notes |
|---|----------|--------|-------|
| 1 | Is Operation A strictly data-only? | **YES** | `profiles` changes are UPDATE-only via ledger join. Remediation ledger `CREATE TABLE IF NOT EXISTS` is infrastructure outside `profiles` schema/CHECK. |
| 2 | Is schema CHECK installation completely excluded? | **YES** | Forward has no `ADD CONSTRAINT` / `profiles_gender_canonical_chk` / `CHECK (` on profiles. |
| 3 | Can the update affect anything other than the four captured exact Nam rows? | **NO** (safe) | Update requires ledger join, `gender = 'Nam'`, original_gender `'Nam'`, and `updated_at` match; count must equal 4. |
| 4 | Does row-count drift fail closed? | **YES** | Exceptions when captured/updated ≠ 4 roll back the transaction. |
| 5 | Does updated_at drift fail closed? | **YES** | Forward and rollback use `IS NOT DISTINCT FROM` / drift counts with exceptions. |
| 6 | Is the backup persistent and batch-specific? | **YES** | `_ppdr_op_a_batch` + `_ppdr_op_a_ledger` keyed by `batch_id`. |
| 7 | Can rollback overwrite a later legitimate change? | **NO** (safe) | Rollback aborts when any target is not still `male` + `updated_at = applied_at`. |
| 8 | Is rollback deterministic? | **YES** | Explicit batch ID; restores `original_gender` + `original_updated_at`; marks `rolled_back` only after restore. |
| 9 | Are Operation A and Operation B fully separated? | **YES** | Docs/runbook/manifest exclude QA quarantine; no Auth/ban/quarantine SQL in forward/rollback. |
| 10 | Does any file imply Production GO? | **NO** (safe) | All state `NOT APPLIED` / `productionGo: NO`; Owner must still choose PITR condition. |
| 11 | Were any Production or Staging mutations performed? | **NO** | Package development + static tests only. |
| 12 | Are unrelated files untouched? | **YES** | Diff limited to Op A package, one test file, and evidence; lockfiles unchanged. |
| 13 | Are package and lockfiles unchanged? | **YES** | `package.json` / `package-lock.json` clean. |

## Blockers

**0**

## Verdict

`PRODUCTION_PLAYER_GENDER_OPERATION_A_HARDENED_READY_FOR_COMMIT_REVIEW`

Ready for **commit review only**. Not applied. Not Owner GO.
