# E2E-07 — GOV-08 Performance Benchmark

**Budget version:** `e2e07-gov08-mvp-local-v1`  
**Class:** `MVP_LOCAL_CERTIFICATION`

## Method

- Warm-up: 1 run; measured: 3 runs; median reported
- Sizes: 8, 16, 32 participants
- Measures: pool composition, knockout composition (standings from live pool grouping), thin organizer path for size 8
- Wall-clock lives in `performanceResults` only — **never** in `deterministicFingerprint`

## Thresholds (ms medians)

| Metric | 8 | 16 | 32 |
|--------|---|----|----|
| poolCompositionMedian | 500 | 1000 | 2000 |
| knockoutCompositionMedian | 500 | 1000 | 2000 |
| fullCertificationScenarioMedian | 5000 | 10000 | 20000 |

`productionSlaClaimForbidden: true`

Implementation: `runGov08PerformanceBenchmark.js`, budgets in `gov08Budgets.js`
