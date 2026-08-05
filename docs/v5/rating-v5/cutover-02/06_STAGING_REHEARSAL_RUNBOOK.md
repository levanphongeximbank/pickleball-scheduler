# CUTOVER-02 — Staging Rehearsal Runbook

**Do not execute Staging mutation until Owner issues `GO-STAGING` and all gates in `09_OWNER_GO_GATES.md` pass.**

## S0 — Baseline

| | |
|--|--|
| Entry | Flags OFF; Staging proof PASS |
| Actions | Snapshot V2/V5 counts; writer-attempt baseline (should be empty) |
| Expected | No blocking; published still V2 |
| Stop | Any Production ref detected |
| Rollback | n/a |
| Evidence | `evidence/S0_baseline.json` |
| Mutations | 0 |

## S1 — Dual-read OBSERVE

| | |
|--|--|
| Entry | S0 OK; Owner approves cohort |
| Actions | Enable `VITE_RATING_V5_DUAL_READ_COMPARE_ENABLED=true` for small cohort |
| Expected | V2 published unchanged; raw compare evidence collected |
| Stop | User-facing rating changes; Production deny trip |
| Rollback | Flag → false |
| Evidence | dual-read evidence sink / report |
| Mutations | 0 data writes |

## S2 — Writer freeze OBSERVE

| | |
|--|--|
| Entry | S1 OK |
| Actions | `VITE_RATING_V5_WRITER_FREEZE_MODE=OBSERVE` (+ DB setting if SQL applied) |
| Expected | Attempts recorded; no blocks |
| Stop | Hidden writers without inventory row |
| Rollback | Mode → OFF |
| Evidence | writer attempt audit |

## S3 — Writer freeze ENFORCE

| | |
|--|--|
| Entry | Owner **GO-STAGING**; DB guard applied; bypass risk closed |
| Actions | Mode `ENFORCE`; verify V5 shadow still writes; verify targeted V2 blocked |
| Expected | Targeted legacy writers fail-closed; V5/Elo/unrelated pass |
| Stop | Collateral blocks; Production targeting |
| Rollback | Mode → OFF immediately |
| Evidence | blocked attempts + V5 persist proof |

## S4 — Restore

| | |
|--|--|
| Entry | S3 complete or abort |
| Actions | Freeze OFF; confirm writers restored |
| Expected | Previous behavior |
| Evidence | rollback verification |

## S5 — Reconciliation

| | |
|--|--|
| Entry | S0–S4 evidence present |
| Actions | Build reconciliation report (`buildReconciliationReport`) |
| Expected | Coverage / mismatch / blocked / rollback metrics |
| Note | Thresholds require `OWNER_APPROVAL_REQUIRED=YES` |

Each stage requires: entry criteria, actions, expected outputs, stop conditions, rollback, evidence files, mutation count, sign-off.
