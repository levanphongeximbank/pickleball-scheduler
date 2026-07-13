# V5-P1 — Rollout Cohort Auth Audit

**Date:** 2026-07-13  
**Rule:** `rating_v5_pilot_enrollments` is the **only** authorization source for V5 access.

## Summary

| Category | Count | Auth use |
|----------|-------|----------|
| Fixed (enrollment SOT) | 2 files | `ratingV5AccessService.js`, `ratingV5RolloutService.js` |
| Metadata only (OK) | 6 locations | Server persistence stamping |
| Tests updated | 2 | UI + unit enrollment SOT |
| Docs reference | 4 | Architecture notes |

## Authorization (must use enrollment)

| File | Status |
|------|--------|
| `src/features/pick-vn-rating-v5/services/ratingV5AccessService.js` | **FIXED** — `fetchMyPilotEnrollment` + `isPilotEnrollmentActive` |
| `src/features/pick-vn-rating-v5/services/ratingV5RolloutService.js` | **FIXED** — `isUserInRolloutCohort` deprecated (returns false) |

## Metadata / traceability only (NOT auth)

| File | Usage |
|------|-------|
| `src/features/pick-vn-rating-v5/server/scoreAssessmentCompletion.js` | Stamps `rollout_cohort` on assessment payload |
| `src/features/pick-vn-rating-v5/constants/v5TableRegistry.js` | Documents shadow metadata |
| SQL migrations | Column `rollout_cohort` on profiles/assessments |
| `tests/pick-vn-rating-v5-*.test.js` | Fixture data for scoring |

## Server gate (authoritative)

| RPC | Role |
|-----|------|
| `rating_v5_assert_pilot_gate` | Blocks start/complete without active enrollment |
| `rating_v5_get_my_pilot_enrollment` | Frontend route/menu auth |
| `rating_v5_start_assessment` | Calls pilot gate before insert |

## Removed anti-pattern

```text
profile.rollout_cohort === pilot_cohort_label  →  NOT USED FOR AUTH
```

Stale profile cohort must **not** grant access (enrollment SOT).

## Tests

- `tests/rating-v5-enrollment-sot.test.js` — unit coverage
- `tests/ui/pick-vn-rating-v5-ui.test.jsx` — enrollment-based access tests

## Production grep audit command

```bash
rg "isUserInRolloutCohort|profile\.rollout_cohort" src --glob "*.{js,jsx}"
```

Expected: only deprecated function + metadata paths, not access checks.
