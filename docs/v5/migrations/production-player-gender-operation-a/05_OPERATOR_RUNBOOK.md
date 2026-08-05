# Operation A — Operator Runbook (Gender Normalization Only)

**Production GO default:** NO  
**Do not execute any file in this package without exact written Owner GO for Operation A only.**  
**Do not run Operation B (QA quarantine) in this procedure.**

## Files and stages

| Stage | Exact file | Allowed statements |
|-------|------------|-------------------|
| Precheck | `01_PRECHECK_SELECT_ONLY.sql` | SELECT only |
| Forward | `02_FORWARD_DATA_ONLY.sql` | transactional data + remediation ledger DDL |
| Postcheck | `03_POSTCHECK_SELECT_ONLY.sql` | SELECT only |
| Rollback | `04_ROLLBACK_BY_BATCH.sql` | only under separate rollback decision / emergency |

Never execute legacy `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE*.sql` for Operation A.

## Sequence

1. Obtain **exact written Owner GO for Operation A only** (gender data normalization). Confirm Owner also chose either:
   - **A)** BLOCK until PITR proven, or
   - **B)** ACCEPT limited no-PITR risk for exactly four guarded rows.
2. Prove Production project identity equals `expuvcohlcjzvrrauvud` (precheck identity query + tooling project ref).
3. Run **`01_PRECHECK_SELECT_ONLY.sql`** (SELECT only).
4. Compare live results to `06_OWNER_DECISION_PACKAGE.md`:
   - target count must be exactly **4**
   - target profile IDs must match the approved set
   - each target `updated_at` must match the approved precheck snapshot (or a freshly Owner-approved snapshot superseding it)
5. **STOP** on any drift (see STOP conditions).
6. Generate and record an explicit batch UUID. Replace `__OPERATOR_BATCH_ID__` in `02_FORWARD_DATA_ONLY.sql` with that UUID (both placeholder sites if present; forward has one assignment).
7. Run **`02_FORWARD_DATA_ONLY.sql`** inside Production with a session that can commit. On any exception, transaction rolls back — do not retry blindly; re-run precheck.
8. Replace `__OPERATOR_BATCH_ID__` in `03_POSTCHECK_SELECT_ONLY.sql` and run postcheck.
9. Retain batch ID, precheck outputs, forward notices, and postcheck outputs as evidence.
10. **Do not run Operation B.**
11. Rollback only via `04_ROLLBACK_BY_BATCH.sql` under a separately documented rollback decision or defined emergency. Replace `__OPERATOR_BATCH_ID__` first.

## STOP conditions (fail closed)

Stop immediately — do not run forward — if any of the following are true:

- Production project identity is not proven as `expuvcohlcjzvrrauvud`
- live `gender = 'Nam'` count is not exactly **4**
- target IDs differ from the approved decision package
- any target `updated_at` differs from the approved precheck snapshot
- any unresolved / incomplete Operation A batch exists (`status` not in `applied` / `rolled_back`)
- Owner GO is missing, ambiguous, or includes Operation B / CHECK installation
- Operator batch UUID placeholder `__OPERATOR_BATCH_ID__` is still present in forward SQL

## Postcheck acceptance (after forward)

- `remaining_nam = 0`
- `remaining_nu = 0` (unless separately explained outside Operation A)
- `non_canonical_count = 0`
- `male` count increased by exactly 4 vs approved precheck
- total profiles unchanged
- batch ledger row count = 4 for the applied batch
- each ledger profile matches post-op state (`male` + `updated_at = applied_at`)
- `profiles_gender_canonical_chk` still absent
- certified QA counts unchanged vs precheck baseline

## Rollback notes

Rollback restores `original_gender` and `original_updated_at` for the batch only when every target is still exactly post-operation (`male` + `updated_at = applied_at`). If any row changed afterward, rollback **refuses** and does not overwrite.
