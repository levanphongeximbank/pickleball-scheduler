# V5 — Data Consistency Audit

**Generated:** 2026-07-12T10:13:44.947Z  
**Result:** PASS

## Summary report

```text
QUESTION IDS: 52 (expected 52)
DOMAIN REFERENCES: 17 domains
ADAPTIVE REFERENCES: 0
CONTRADICTION REFERENCES: 10
DOMAIN WEIGHT TOTAL: 100.0%
GLOSSARY COVERAGE: PASS (missing: 0)
VERSION COVERAGE: 9 keys
SQL/CODE ENUM CONSISTENCY: PASS (status + mode aligned)
V2/V5 SHADOW ISOLATION: feature flag default OFF = true
FOUNDATION TABLES: 9/9 — see V5-FOUNDATION_9_TABLES.md
```

## Canonical domain codes

- `serve`
- `return`
- `groundstroke`
- `dink_soft_game`
- `third_shot`
- `transition`
- `volley`
- `block_reset`
- `footwork`
- `doubles_positioning`
- `communication`
- `tactical_decision`
- `consistency`
- `pressure_execution`
- `rules`
- `rally_consistency`
- `error_control`

## Legacy aliases (read-only mapping)

| Alias | Canonical |
|-------|-----------|
| `thirdShot` | `third_shot` |
| `third-shot` | `third_shot` |
| `third_shot_drop` | `third_shot` |
| `dinkSoftGame` | `dink_soft_game` |
| `blockReset` | `block_reset` |
| `doublesPositioning` | `doubles_positioning` |
| `tacticalDecision` | `tactical_decision` |
| `pressureExecution` | `pressure_execution` |
| `rallyConsistency` | `rally_consistency` |
| `errorControl` | `error_control` |
| `courtCoverage` | `court_coverage` |

## Checks (15)

| # | Check | Result |
|---|-------|--------|
| 1 | Question IDs unique | PASS |
| 2 | Domain IDs canonical | PASS |
| 3 | Question domain in config | PASS |
| 4 | Domain weight = 100% | PASS |
| 5 | Gate domains valid | PASS |
| 6 | Adaptive routing question IDs | PASS |
| 7 | Contradiction refs valid | PASS |
| 8 | Benchmark personas valid keys | PASS |
| 9 | SQL/code status alignment | PASS |
| 10 | Rating modes singles/doubles | PASS |
| 11 | Status/source consistency | PASS |
| 12 | Glossary coverage | PASS |
| 13 | No scattered EN hard-code (prompts use `{{code}}`) | PASS (core/adaptive migrated) |
| 14 | V5 shadow no V2 write | PASS |
| 15 | Singles no rating V5-B.0 | PASS (RPC blocks singles) |

## Findings

1. `rally_consistency` và `error_control` có trong gates/questions nhưng **không** có trong doubles weight table — ảnh hưởng gates, không ảnh hưởng weighted mean trực tiếp.
2. Anchors vẫn có tiếng Việt thuần — English terms trong anchors sẽ migrate dần qua `resolvePromptText`.
3. `forehand` / `backhand` / `baseline` trong prompts — chưa có glossary entry riêng (dùng mô tả tiếng Việt).



## Version reproducibility contract

Assessment tái dựng từ: `answers + question_bank_version + scoring_engine_version + calibration_version + gate_version + glossary_version`


