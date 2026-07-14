# V5-P1C.7 — Production Browser Smoke Results

**Gate:** P1-C.7 browser smoke  
**Domain:** `https://pickleball-scheduler-eight.vercel.app`  
**Enrolled test user:** `lephong.banker@gmail.com` (WA-03)  
**Control user:** `lephong.eximbank@gmail.com` (non-enrolled)  
**Evidence:** `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-59-18-676Z-p1c7-browser/`

## Enrolled-user flow

| Check | Result |
|-------|--------|
| Login (magic link) | PASS |
| Menu “Đánh giá V5 (shadow)” | PASS |
| Route `/player/skill-assessment-v5` | PASS |
| Draft / resume | PASS (`7e3331f7-97bb-4c3f-80eb-c01a986e85c0`) |
| Complete assessment via Edge | PASS (HTTP 200, `ok:true`) |
| Provisional result + shadow notice | PASS |
| Network = Production only | PASS (no staging hits) |
| Question-step counter helper | WARN (counter=0 after resume; completion still succeeded) |

## Non-enrolled control

| Check | Result |
|-------|--------|
| Menu hidden | PASS |
| Direct route blocked (no workspace) | PASS |
| `rating_v5_assert_pilot_gate` | PASS → `PILOT_NOT_ENROLLED` |
| `rating_v5_start_assessment` (authenticated) | PASS → `PILOT_NOT_ENROLLED` |
| Direct Edge POST with fake assessment id | Edge returns `ASSESSMENT_NOT_FOUND` before pilot message; server start gate above is authoritative |

## Integrity after completion

| Check | Result |
|-------|--------|
| Completed assessments for test user | **1** |
| Canonical `assessment_complete` events | **1** (no duplicates) |
| Shadow profile | `is_shadow=true`, cohort `club-rating-v5-production-wave-a` |
| V2 `pick_vn_player_ratings` | **0** unchanged |
| Cross-user/tenant | event/assessment tenant `venue-prod-main` only |

### Version stamping (assessment row)

| Field | Value |
|-------|-------|
| `assessment_version` | `assessment-v5.0f` |
| `question_bank_version` | `qbank-v5.0f` |
| `scoring_engine_version` | `scoring-v5.0f` |
| `gate_version` | `gates-v5.0f` |
| `calibration_version` | `calibration-v5.0f` |
| `glossary_version` | `glossary-v5.0f` |
| `reliability_version` | `reliability-v5.0` |
| `rollout_cohort` | `club-rating-v5-production-wave-a` |
| `is_shadow` | `true` |

---

```text
ENROLLED USER MENU/ROUTE: PASS
ASSESSMENT COMPLETION: PASS
NON-ENROLLED BLOCK: PASS
RATING EVENT INTEGRITY: PASS
PRODUCTION ISOLATION: PASS
```
