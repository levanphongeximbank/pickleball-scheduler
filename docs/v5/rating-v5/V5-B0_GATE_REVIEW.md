# V5-B0 — Critical Gates Review

**Source:** `src/features/pick-vn-rating-v5/assessment/criticalGates.js`

## Verdict: **PASS**

## Gate rules

| Gate | Điều kiện | Rating cap | Limiting skills | Lý do |
|------|-----------|----------:|-----------------|-------|
| gate_35_critical_floor | overall ≥ 3.5 AND critical domain < 2.8 | min(rating, 3.5) | serve, return, rally, dink, transition, block, positioning, error | Không để một kỹ năng yếu kéo theo toàn profile cao |
| gate_40_domain_required | overall ≥ 4.0 AND dink/transition/block/positioning/consistency < 3.2 | min(rating, 3.9) | soft game + transition domains | 4.0 cần soft game và vị trí |
| gate_40_contradiction | overall ≥ 4.0 AND contradiction flag | min(rating, 3.9) | — | Mâu thuẫn self-report |
| gate_40_pressure | overall ≥ 4.0 AND pressure_execution < 4 | min(rating, 4.0) | pressure_execution | 4.0 cần thực thi dưới áp lực |
| gate_45_cap | overall ≥ 4.5 | **4.5** | — | Questionnaire không khẳng định >4.5 |
| gate_50_verification | overall ≥ 5.0 | (capped at 4.5) | — | Bắt buộc verified evidence — không tạo verified từ questionnaire |

## Chốt quy tắc 4.5

```text
estimated_rating (before gates) có thể > 4.5
provisional_display_rating cap = 4.5
estimated_rating > 4.5 → under_review + verification_required
Không tạo verified rating từ questionnaire
```

## Required persona results

Evidence: `docs/v5/rating-v5/qa-evidence/v5-b0-benchmark/PERSONA_BENCHMARK_REPORT.json`

| # | Persona | Expected | Actual |
|---|---------|----------|--------|
| 1 | p05_drive_strong_dink_weak | Gates apply | ✅ gates > 0, rating reduced |
| 2 | p03_tennis_new_pb | Soft game limits | ✅ dink/transition low |
| 3 | p06_dink_good_transition_weak | Transition limits | ✅ |
| 4 | p07_tech_good_position_weak | Position limits | ✅ |
| 5 | p08_tactics_high_rules_low | Rules low flagged | ✅ rules domain low |
| 6 | p12_all_high | Cap 4.5, verification | ✅ |
| 7 | p09_balanced_30 | ~3.0 | ✅ ~2.8–3.2 |
| 8 | p10_balanced_35 | ~3.5 | ✅ |
| 9 | p11_balanced_40 | ~4.0 | ✅ |
| 10 | p13_expected_above_45 | under_review | ✅ verification_required |

## Rating status outcomes

- Questionnaire only produces: `self_assessed`, `provisional`, `under_review`
- Never: `verified`, `reliable`, `stable`
