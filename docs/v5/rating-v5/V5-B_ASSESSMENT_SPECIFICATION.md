# V5-B — Assessment Specification

**Versions:** `assessment-v5.0` | `qbank-v5.0` | `calibration-v5.0`

## 1. Scale

| Parameter | Value |
|-----------|-------|
| Core questions | 22 |
| Max adaptive | 8 |
| Total bank | 52 (22 core + 30 adaptive) — expandable to 60 |
| Typical session | 24–26 questions, ~5–7 min |
| Anchor scale | 0–7 behavioral (per skill) |
| Public range | 1.5–6.0 |
| Display step | 0.1 (display only) |

## 2. Anchor → skill mapping

```javascript
skillMean = 1.5 + (anchor / 7) * (6.0 - 1.5)
// No rounding at this step
```

## 3. Domain weights (doubles)

| Domain | Weight |
|--------|-------:|
| serve | 6% |
| return | 7% |
| groundstroke | 9% |
| dink_soft_game | 12% |
| third_shot | 6.5% |
| transition | 6.5% |
| volley | 4% |
| block_reset | 8% |
| footwork | 8% |
| doubles_positioning | 5% |
| communication | 5% |
| tactical_decision | 10% |
| consistency | 4.5% |
| pressure_execution | 4.5% |
| rules | 4% |

Source: `src/features/pick-vn-rating-v5/constants/domainWeights.js`

## 4. Core questions (22)

| # | ID | Domain |
|---|-----|--------|
| 1 | core_exp_01 | consistency |
| 2 | core_exp_02 | pressure_execution |
| 3 | core_srv_01 | serve |
| 4 | core_srv_02 | serve |
| 5 | core_ret_01 | return |
| 6 | core_gs_01 | groundstroke |
| 7 | core_gs_02 | groundstroke |
| 8 | core_gs_03 | rally_consistency |
| 9 | core_dink_01 | dink_soft_game |
| 10 | core_dink_02 | dink_soft_game |
| 11 | core_dink_03 | error_control |
| 12 | core_ts_01 | third_shot |
| 13 | core_tr_01 | transition |
| 14 | core_tr_02 | transition |
| 15 | core_vol_01 | volley |
| 16 | core_blk_01 | block_reset |
| 17 | core_blk_02 | block_reset |
| 18 | core_pos_01 | doubles_positioning |
| 19 | core_pos_02 | communication |
| 20 | core_tac_01 | tactical_decision |
| 21 | core_tac_02 | tactical_decision |
| 22 | core_rules_01 | rules |

Full prompts + 8 anchors per question: `src/features/pick-vn-rating-v5/assessment/coreQuestions.js`

## 5. Adaptive routing

| Condition | Route |
|-----------|-------|
| Recent avg anchor 0–2 | `foundation` |
| Recent avg anchor 3–4 | `medium` |
| Recent avg anchor 5–7 | `advanced` |
| Contradiction detected | `consistency_check` |

Engine: `adaptiveRouting.js` — selects question with highest domain uncertainty.

## 6. Critical gates

| Gate | Rule |
|------|------|
| ≥ 3.5 | All critical domains ≥ 2.8 |
| ≥ 4.0 | dink, transition, block_reset, positioning, consistency ≥ 3.2; no severe contradiction; pressure_execution ≥ 4 |
| ≥ 4.5 | `provisional ≤ 4.5`, `verification_required`, status `under_review` |
| ≥ 5.0 | Requires verified evidence (V5-C/D) — questionnaire alone insufficient |

Critical domains: serve, return, rally_consistency, dink_soft_game, transition, block_reset, positioning, error_control.

## 7. Output schema

```json
{
  "initialMean": 3.42,
  "initialDeviation": 0.48,
  "provisionalRating": 3.42,
  "skillVector": { "serve": 3.8, "dink_soft_game": 3.2 },
  "confidenceScore": 44,
  "estimatedError": 0.41,
  "estimatedRange": { "low": 3.0, "high": 3.8 },
  "warningFlags": [],
  "appliedGates": [],
  "limitingSkills": ["transition"],
  "ratingStatus": "self_assessed",
  "verificationRequired": false
}
```

## 8. Owner content review checklist

- [ ] Behavioral anchor wording (Vietnamese, per skill)
- [ ] Adaptive question phrasing
- [ ] Domain weight adjustments
- [ ] Gate thresholds for Vietnamese player population
- [ ] Singles-specific question extensions (V5-B.1)

## 9. Pilot targets (not claimed)

| Metric | Target |
|--------|--------|
| Questionnaire MAE | ≤ 0.25 |
| Coach/court MAE | ≤ 0.15–0.20 |
| Stable match MAE | ≤ 0.10–0.15 (directional) |
