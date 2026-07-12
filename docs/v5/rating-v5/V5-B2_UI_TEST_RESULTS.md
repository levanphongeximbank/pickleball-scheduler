# V5-B.2 — UI Test Results

**Date:** 2026-07-12  
**Suite:** `tests/ui/pick-vn-rating-v5-ui.test.jsx`  
**Command:** `npx vitest run tests/ui/pick-vn-rating-v5-ui.test.jsx`

---

## Results

```text
UI TESTS: 21/21 PASS
```

| # | Test | Result |
|---|------|--------|
| 1 | Feature flag off → nav hidden | PASS |
| 2 | User outside rollout cohort blocked | PASS |
| 3 | User in cohort can access | PASS |
| 4 | Core questions = 22 | PASS |
| 5 | Adaptive max = 8 | PASS |
| 6 | Total max = 30 | PASS |
| 7 | Unresolved placeholders = 0 | PASS |
| 8 | Terminology English (VI) format | PASS |
| 9 | Draft preserves answers | PASS |
| 10 | Refresh resume draft | PASS |
| 11 | Version mismatch → restart | PASS |
| 12 | Submit payload 4 fields only | PASS |
| 13 | Double submit same assessment_id | PASS |
| 14 | Retry reuses assessment_id | PASS |
| 15 | Edge response renders correctly | PASS |
| 16 | Provisional cap 4.5 notice | PASS |
| 17 | Singles payload mode tracked | PASS |
| 18 | Error code mapping | PASS |
| 19 | V2 store unchanged | PASS |
| 20 | Shadow notice always shown | PASS |
| + | Progress groups cover 22 core | PASS |

---

## Staging enablement

```env
VITE_PICK_VN_RATING_V5_ENABLED=true
VITE_SUPABASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co
VITE_SUPABASE_ANON_KEY=<staging anon>
```

Optional explicit Edge base:

```env
VITE_PICK_VN_RATING_V5_EDGE_BASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co
```
