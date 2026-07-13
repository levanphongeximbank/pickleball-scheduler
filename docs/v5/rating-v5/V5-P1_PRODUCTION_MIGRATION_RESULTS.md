# V5-P1-B — Production Migration Results

**Gate:** P1-B — infrastructure only  
**Date:** 2026-07-13  
**Production ref:** `expuvcohlcjzvrrauvud`  
**Git SHA:** `e37ce0ebab163ab891edd8b100c5f02accd7bce8`

## Verdict

```text
PRODUCTION MIGRATION: PASS
```

## Pre-apply baseline

Evidence: `qa-evidence/v5-p1b-backup/BASELINE_SNAPSHOT.json`

| Metric | Value |
|--------|-------|
| `pick_vn_player_ratings` (V2) | 0 |
| `profiles` | 27 |
| `club_members` | 4 |
| Snapshot at | 2026-07-13T15:29:08Z |

## Applied bundle (checksums pinned in P1-A)

| # | File | SHA256 |
|---|------|--------|
| 1 | `PHASE_V5A_RATING_FOUNDATION.sql` | `9ff3b05e…` |
| 2 | `PHASE_V5B1_COMPLETE_ASSESSMENT.sql` | `5445e666…` |
| 3 | `PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql` | `d407a548…` |
| 4 | `PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql` | `b952f60d…` |

Apply script: `node scripts/apply-phase-v5p1b-production-rating.mjs`

## Post-apply verification

| Check | Expected | Actual |
|-------|----------|--------|
| V5 tables present | 5 | ✅ 5 |
| `allow_v5_assessment` | `false` | ✅ `false` |
| `pilot_cohort_label` | `club-rating-v5-production-pilot` | ✅ |
| Active enrollments | 0 | ✅ 0 |
| V2 row count | unchanged (0) | ✅ 0 |

Evidence: `qa-evidence/v5-p1b-backup/MIGRATION_APPLY_REPORT.json`

## Explicit non-actions (honored)

- No user enrollment
- `allow_v5_assessment` remains `false`
- `VITE_PICK_VN_RATING_V5_ENABLED` unchanged (not set on Production Vercel)

## Rollback reference

`V5-P1_PRODUCTION_DISABLE_RUNBOOK.md`
