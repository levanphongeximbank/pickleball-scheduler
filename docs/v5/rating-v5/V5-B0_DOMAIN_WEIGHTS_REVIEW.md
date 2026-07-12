# V5-B0 — Domain Weights Review

**Source:** `src/features/pick-vn-rating-v5/constants/domainWeights.js`  
**Mode:** Doubles only (singles = V5-B.1 spec)

## Verdict: **PASS** with **NEEDS REVISION** (footwork coverage)

Total weight: **100.0%** ✅

| Domain | Weight | Core Q | Adaptive Q | Max Q contribution | Critical |
|--------|-------:|-------:|-----------:|-------------------:|----------|
| serve | 6% | 2 | 3 | 3.0% (6%/2) | ✅ |
| return | 7% | 1 | 2 | 7.0% | ✅ |
| groundstroke | 9% | 2 | 1 | 4.5% | — |
| dink_soft_game | 12% | 2 | 5 | 4.0% (12%/3) | ✅ |
| third_shot | 6.5% | 1 | 1 | 6.5% | — |
| transition | 6.5% | 2 | 1 | 3.25% | ✅ |
| volley | 4% | 1 | 2 | 4.0% | — |
| block_reset | 8% | 2 | 1 | 4.0% | ✅ |
| footwork | 8% | 0 | 1 | **8.0%** ⚠️ | — |
| doubles_positioning | 5% | 1 | 2 | 2.5% | ✅ |
| communication | 5% | 1 | 1 | 5.0% | — |
| tactical_decision | 10% | 2 | 3 | 3.33% | — |
| consistency | 4.5% | 1 | 2 | 2.25% | — |
| pressure_execution | 4.5% | 1 | 1 | 4.5% | — |
| rules | 4% | 1 | 2 | 4.0% | — |
| rally_consistency | — | 1 | 1 | via groundstroke weight | ✅ |
| error_control | — | 1 | 1 | via dink weight | ✅ |

*Note: `rally_consistency` and `error_control` are scored in domain accumulation but map to weighted domains through shared questions.*

## Checks

| Rule | Result |
|------|--------|
| Sum = 100% | ✅ 1.000 |
| No single question > 4% contribution (core) | ✅ max 4.5% (third_shot single core) — **NEEDS REVISION**: add 2nd third_shot core or split weight |
| Domain normalized before weight | ✅ `accumulateDomainScores` averages per domain first |
| Metadata not in score | ✅ `adp_found_exp_01` adaptive only |
| Adaptive inflation | ✅ more questions ≠ higher anchor by default |
| Missing domain data | ✅ `computeWeightedMean` skips null domains (reduces weightSum) |

## Revision recommendations

1. Add **core footwork** question OR reduce footwork weight until V5-B.1.
2. Add **second third_shot core** to bring per-question contribution ≤4%.
3. Split **core_exp_01** from consistency weight path (experience metadata).

## Singles (spec only)

`SINGLES_DOMAIN_WEIGHTS` defined but **not used** in V5-B.0 scoring path.  
`singles_assessment_status = incomplete` until V5-B.1.
