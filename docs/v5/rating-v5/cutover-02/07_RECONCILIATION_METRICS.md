# CUTOVER-02 — Reconciliation Metrics Specification

Code: `buildReconciliationReport()` / `SUGGESTED_STAGING_THRESHOLDS`

## Required metrics

- eligible V2 population
- users with V5 shadow profile
- paired V2/V5 records
- V5 coverage percentage
- missing V5 percentage
- invalidated V5 count
- out-of-range count
- tenant mismatch count
- identity mismatch count
- stale V2 count
- stale V5 count
- raw exact-match count
- normalized comparison status (`UNAPPROVED_SCALE_NO_EQUIVALENCE` until Owner approves)
- unapproved-scale count
- writer attempts by writer
- blocked attempts by writer
- unexpected writers
- rollback success

## Thresholds

Suggested Staging rehearsal thresholds exist in code for discussion only.

```text
OWNER_APPROVAL_REQUIRED=YES
```

Do **not** treat suggested numbers as Production GO criteria.
