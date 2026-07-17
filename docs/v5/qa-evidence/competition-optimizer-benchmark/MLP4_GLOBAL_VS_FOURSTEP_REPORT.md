# MLP4 Benchmark: Global Optimizer vs Four-step

Generated: 2026-07-17T08:41:21.179Z
Algorithm: `mlp4-global-optimizer-v1`
Seeds per fixture: **100**
Fixtures (team counts): 4, 6, 8, 12, 16

## Verdict

**PASS** — Global Optimizer is not worse than Four-step on authority ranking across all fixtures, and average balance metrics are not worse.

- Authority not-worse (all seeds): PASS
- Balance averages not-worse: PASS

## Fixture: 4 teams (16 athletes)

- Seeds completed: 100/100
- Authority not-worse: PASS (worse=0)
- Improved vs Four-step (authority): 100
- Identical signatures: 0
- Balance averages not-worse: PASS

### Metric average verdicts (lower is better)

| Metric | Four-step avg | Optimizer avg | Δ | Pass |
|---|---:|---:|---:|:---:|
| TeamAverageRange | 0.2975 | 0.0825 | -0.215 | Y |
| TeamAverageStdDev | 0.1101 | 0.0357 | -0.0744 | Y |
| MaleAverageStdDev | 0.1056 | 0.0714 | -0.0342 | Y |
| FemaleAverageStdDev | 0.3242 | 0 | -0.3242 | Y |
| MixedGap | 2.4625 | 2.4625 | 0 | Y |
| AuthorityPenalty | 0 | 0 | 0 | Y |
| DefaultPenalty | 233.56 | 157.72 | -75.84 | Y |
| CandidateEvaluated | — | — | — | info |
| DurationMs | — | — | — | info |

### Four-step

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.2975 | 0.2975 | 0.2975000000000003 | 0.2975000000000003 |
| TeamAverageStdDev | 0.1101 | 0.1101 | 0.110104708686777 | 0.110104708686777 |
| MaleAverageStdDev | 0.1056 | 0.1056 | 0.10561575403319322 | 0.10561575403319323 |
| FemaleAverageStdDev | 0.3242 | 0.3242 | 0.3242298567374694 | 0.3242298567374694 |
| MixedGap | 2.4625 | 2.4625 | 2.4624999999999995 | 2.4624999999999995 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 233.56 | 233.56 | 233.56 | 233.56 |
| CandidateEvaluated | 1 | 1 | 1 | 1 |
| DurationMs | 0.1 | 0 | 0 | 1 |

### Global Optimizer

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.0825 | 0.0825 | 0.08249999999999957 | 0.08250000000000002 |
| TeamAverageStdDev | 0.0357 | 0.0357 | 0.035723547906107905 | 0.0357235479061081 |
| MaleAverageStdDev | 0.0714 | 0.0714 | 0.07144709581221614 | 0.07144709581221614 |
| FemaleAverageStdDev | 0 | 0 | 0 | 0 |
| MixedGap | 2.4625 | 2.4625 | 2.462499999999999 | 2.4625000000000004 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 157.72 | 157.72 | 157.72 | 157.72 |
| CandidateEvaluated | 154.31 | 153 | 149 | 198 |
| DurationMs | 3.52 | 3 | 2 | 18 |

### Delta (Optimizer − Four-step)

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | -0.215 | -0.215 | -0.215 | -0.215 |
| TeamAverageStdDev | -0.0744 | -0.0744 | -0.0744 | -0.0744 |
| MaleAverageStdDev | -0.0342 | -0.0342 | -0.0342 | -0.0342 |
| FemaleAverageStdDev | -0.3242 | -0.3242 | -0.3242 | -0.3242 |
| MixedGap | 0 | 0 | 0 | 0 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | -75.84 | -75.84 | -75.84 | -75.84 |
| CandidateEvaluated | 153.31 | 152 | 148 | 197 |
| DurationMs | 3.42 | 3 | 1 | 17 |

## Fixture: 6 teams (24 athletes)

- Seeds completed: 100/100
- Authority not-worse: PASS (worse=0)
- Improved vs Four-step (authority): 100
- Identical signatures: 0
- Balance averages not-worse: PASS

### Metric average verdicts (lower is better)

| Metric | Four-step avg | Optimizer avg | Δ | Pass |
|---|---:|---:|---:|:---:|
| TeamAverageRange | 0.3475 | 0.085 | -0.2625 | Y |
| TeamAverageStdDev | 0.1165 | 0.0311 | -0.0854 | Y |
| MaleAverageStdDev | 0.0905 | 0.0615 | -0.029 | Y |
| FemaleAverageStdDev | 0.2873 | 0.0024 | -0.2849 | Y |
| MixedGap | 2.3583 | 2.3583 | 0 | Y |
| AuthorityPenalty | 0 | 0 | 0 | Y |
| DefaultPenalty | 228.39 | 151.12 | -77.27 | Y |
| CandidateEvaluated | — | — | — | info |
| DurationMs | — | — | — | info |

### Four-step

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.3475 | 0.3475 | 0.34749999999999925 | 0.34749999999999925 |
| TeamAverageStdDev | 0.1165 | 0.1165 | 0.11647081775659025 | 0.11647081775659027 |
| MaleAverageStdDev | 0.0905 | 0.0905 | 0.09054234736666965 | 0.09054234736666965 |
| FemaleAverageStdDev | 0.2873 | 0.2873 | 0.28731032390469763 | 0.2873103239046977 |
| MixedGap | 2.3583 | 2.3583 | 2.358333333333333 | 2.358333333333334 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 228.39 | 228.39 | 228.39 | 228.39 |
| CandidateEvaluated | 1 | 1 | 1 | 1 |
| DurationMs | 0.08 | 0 | 0 | 1 |

### Global Optimizer

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.085 | 0.085 | 0.08500000000000041 | 0.08500000000000041 |
| TeamAverageStdDev | 0.0311 | 0.0311 | 0.03113869065255567 | 0.03113869065255567 |
| MaleAverageStdDev | 0.0615 | 0.0615 | 0.061491869381244235 | 0.061491869381244235 |
| FemaleAverageStdDev | 0.0024 | 0.0024 | 0.0023570226039551605 | 0.0023570226039551605 |
| MixedGap | 2.3583 | 2.3583 | 2.358333333333334 | 2.358333333333334 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 151.12 | 151.12 | 151.12 | 151.12 |
| CandidateEvaluated | 150.7 | 150 | 149 | 156 |
| DurationMs | 5.05 | 5 | 4 | 18 |

### Delta (Optimizer − Four-step)

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | -0.2625 | -0.2625 | -0.2625 | -0.2625 |
| TeamAverageStdDev | -0.0853 | -0.0853 | -0.0853 | -0.0853 |
| MaleAverageStdDev | -0.0291 | -0.0291 | -0.0291 | -0.0291 |
| FemaleAverageStdDev | -0.285 | -0.285 | -0.285 | -0.285 |
| MixedGap | 0 | 0 | 0 | 0 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | -77.27 | -77.27 | -77.27 | -77.27 |
| CandidateEvaluated | 149.7 | 149 | 148 | 155 |
| DurationMs | 4.97 | 5 | 3 | 18 |

## Fixture: 8 teams (32 athletes)

- Seeds completed: 100/100
- Authority not-worse: PASS (worse=0)
- Improved vs Four-step (authority): 100
- Identical signatures: 0
- Balance averages not-worse: PASS

### Metric average verdicts (lower is better)

| Metric | Four-step avg | Optimizer avg | Δ | Pass |
|---|---:|---:|---:|:---:|
| TeamAverageRange | 0.335 | 0.165 | -0.17 | Y |
| TeamAverageStdDev | 0.1312 | 0.0579 | -0.0733 | Y |
| MaleAverageStdDev | 0.1416 | 0.0799 | -0.0617 | Y |
| FemaleAverageStdDev | 0.2788 | 0.078 | -0.2008 | Y |
| MixedGap | 2.365 | 2.365 | 0 | Y |
| AuthorityPenalty | 0 | 0 | 0 | Y |
| DefaultPenalty | 232.5988 | 171.14 | -61.4588 | Y |
| CandidateEvaluated | — | — | — | info |
| DurationMs | — | — | — | info |

### Four-step

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.335 | 0.335 | 0.33499999999999996 | 0.33499999999999996 |
| TeamAverageStdDev | 0.1312 | 0.1312 | 0.1311606838957468 | 0.13116068389574684 |
| MaleAverageStdDev | 0.1416 | 0.1416 | 0.14164077582038292 | 0.14164077582038295 |
| FemaleAverageStdDev | 0.2788 | 0.281 | 0.27598049636704386 | 0.2809630480597046 |
| MixedGap | 2.365 | 2.365 | 2.3649999999999998 | 2.365000000000001 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 232.5988 | 232.92 | 232.19 | 232.92 |
| CandidateEvaluated | 1 | 1 | 1 | 1 |
| DurationMs | 0.14 | 0 | 0 | 1 |

### Global Optimizer

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.165 | 0.165 | 0.16499999999999915 | 0.16499999999999915 |
| TeamAverageStdDev | 0.0579 | 0.0579 | 0.057906174109502134 | 0.057906174109502134 |
| MaleAverageStdDev | 0.0799 | 0.0799 | 0.07988028151552785 | 0.07988028151552785 |
| FemaleAverageStdDev | 0.078 | 0.078 | 0.07795982539103069 | 0.07795982539103069 |
| MixedGap | 2.365 | 2.365 | 2.3650000000000007 | 2.3650000000000007 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 171.14 | 171.14 | 171.14 | 171.14 |
| CandidateEvaluated | 150.09 | 150 | 149 | 154 |
| DurationMs | 7.56 | 8 | 6 | 10 |

### Delta (Optimizer − Four-step)

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | -0.17 | -0.17 | -0.17 | -0.17 |
| TeamAverageStdDev | -0.0733 | -0.0733 | -0.0733 | -0.0733 |
| MaleAverageStdDev | -0.0618 | -0.0618 | -0.0618 | -0.0618 |
| FemaleAverageStdDev | -0.2008 | -0.203 | -0.203 | -0.198 |
| MixedGap | 0 | 0 | 0 | 0 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | -61.4588 | -61.78 | -61.78 | -61.05 |
| CandidateEvaluated | 149.09 | 149 | 148 | 153 |
| DurationMs | 7.42 | 8 | 6 | 10 |

## Fixture: 12 teams (48 athletes)

- Seeds completed: 100/100
- Authority not-worse: PASS (worse=0)
- Improved vs Four-step (authority): 100
- Identical signatures: 0
- Balance averages not-worse: PASS

### Metric average verdicts (lower is better)

| Metric | Four-step avg | Optimizer avg | Δ | Pass |
|---|---:|---:|---:|:---:|
| TeamAverageRange | 0.39 | 0.0925 | -0.2975 | Y |
| TeamAverageStdDev | 0.1067 | 0.034 | -0.0727 | Y |
| MaleAverageStdDev | 0.0664 | 0.0664 | 0 | Y |
| FemaleAverageStdDev | 0.2647 | 0.0442 | -0.2205 | Y |
| MixedGap | 2.3908 | 2.3908 | 0 | Y |
| AuthorityPenalty | 0 | 0 | 0 | Y |
| DefaultPenalty | 231.6682 | 159.13 | -72.5382 | Y |
| CandidateEvaluated | — | — | — | info |
| DurationMs | — | — | — | info |

### Four-step

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.39 | 0.39 | 0.3900000000000001 | 0.3900000000000001 |
| TeamAverageStdDev | 0.1067 | 0.1066 | 0.10644406297049486 | 0.10702474889015162 |
| MaleAverageStdDev | 0.0664 | 0.0664 | 0.06640966086011543 | 0.06640966086011545 |
| FemaleAverageStdDev | 0.2647 | 0.2651 | 0.2639233895575675 | 0.2663983024637273 |
| MixedGap | 2.3908 | 2.3908 | 2.3908333333333327 | 2.390833333333334 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 231.6682 | 231.74 | 231.5 | 232.04 |
| CandidateEvaluated | 1 | 1 | 1 | 1 |
| DurationMs | 0.31 | 0 | 0 | 1 |

### Global Optimizer

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.0925 | 0.0925 | 0.0924999999999998 | 0.0924999999999998 |
| TeamAverageStdDev | 0.034 | 0.034 | 0.033990271279686256 | 0.033990271279686256 |
| MaleAverageStdDev | 0.0664 | 0.0664 | 0.06640966086011543 | 0.06640966086011543 |
| FemaleAverageStdDev | 0.0442 | 0.0442 | 0.044221663871405366 | 0.044221663871405366 |
| MixedGap | 2.3908 | 2.3908 | 2.390833333333333 | 2.390833333333333 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 159.13 | 159.13 | 159.13 | 159.13 |
| CandidateEvaluated | 149.5 | 149 | 149 | 151 |
| DurationMs | 16.42 | 16 | 15 | 28 |

### Delta (Optimizer − Four-step)

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | -0.2975 | -0.2975 | -0.2975 | -0.2975 |
| TeamAverageStdDev | -0.0727 | -0.0726 | -0.073 | -0.0725 |
| MaleAverageStdDev | 0 | 0 | 0 | 0 |
| FemaleAverageStdDev | -0.2205 | -0.2209 | -0.2222 | -0.2197 |
| MixedGap | 0 | 0 | 0 | 0 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | -72.5382 | -72.61 | -72.91 | -72.37 |
| CandidateEvaluated | 148.5 | 148 | 148 | 150 |
| DurationMs | 16.11 | 16 | 14 | 28 |

## Fixture: 16 teams (64 athletes)

- Seeds completed: 100/100
- Authority not-worse: PASS (worse=0)
- Improved vs Four-step (authority): 100
- Identical signatures: 0
- Balance averages not-worse: PASS

### Metric average verdicts (lower is better)

| Metric | Four-step avg | Optimizer avg | Δ | Pass |
|---|---:|---:|---:|:---:|
| TeamAverageRange | 0.4557 | 0.1447 | -0.311 | Y |
| TeamAverageStdDev | 0.1288 | 0.0442 | -0.0846 | Y |
| MaleAverageStdDev | 0.0758 | 0.0338 | -0.042 | Y |
| FemaleAverageStdDev | 0.2879 | 0.0808 | -0.2071 | Y |
| MixedGap | 2.3413 | 2.3413 | 0 | Y |
| AuthorityPenalty | 0 | 0 | 0 | Y |
| DefaultPenalty | 242.2369 | 163.111 | -79.1259 | Y |
| CandidateEvaluated | — | — | — | info |
| DurationMs | — | — | — | info |

### Four-step

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.4557 | 0.455 | 0.45500000000000007 | 0.45750000000000046 |
| TeamAverageStdDev | 0.1288 | 0.1289 | 0.1284766515752959 | 0.12901974170645356 |
| MaleAverageStdDev | 0.0758 | 0.0758 | 0.07583326179025932 | 0.07583326179025934 |
| FemaleAverageStdDev | 0.2879 | 0.2879 | 0.28781351791350945 | 0.2884696623455403 |
| MixedGap | 2.3413 | 2.3413 | 2.341249999999999 | 2.341250000000001 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 242.2369 | 242.14 | 242.12 | 242.51 |
| CandidateEvaluated | 1 | 1 | 1 | 1 |
| DurationMs | 0.58 | 1 | 0 | 1 |

### Global Optimizer

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | 0.1447 | 0.145 | 0.11249999999999938 | 0.14500000000000046 |
| TeamAverageStdDev | 0.0442 | 0.0443 | 0.03650770466627555 | 0.04431774475308964 |
| MaleAverageStdDev | 0.0338 | 0.0337 | 0.033736976653962344 | 0.039219683753824446 |
| FemaleAverageStdDev | 0.0808 | 0.0808 | 0.08077203163069505 | 0.08077203163069505 |
| MixedGap | 2.3413 | 2.3413 | 2.34125 | 2.3412500000000005 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | 163.111 | 163.14 | 160.24 | 163.14 |
| CandidateEvaluated | 150.07 | 149 | 149 | 225 |
| DurationMs | 29.34 | 29 | 27 | 35 |

### Delta (Optimizer − Four-step)

| Metric | Average | Median | Best | Worst |
|---|---:|---:|---:|---:|
| TeamAverageRange | -0.311 | -0.31 | -0.3425 | -0.31 |
| TeamAverageStdDev | -0.0846 | -0.0846 | -0.0924 | -0.0842 |
| MaleAverageStdDev | -0.042 | -0.0421 | -0.0421 | -0.0366 |
| FemaleAverageStdDev | -0.2072 | -0.2072 | -0.2077 | -0.207 |
| MixedGap | 0 | 0 | 0 | 0 |
| AuthorityPenalty | 0 | 0 | 0 | 0 |
| DefaultPenalty | -79.1259 | -79 | -81.9 | -78.98 |
| CandidateEvaluated | 149.07 | 148 | 148 | 224 |
| DurationMs | 28.76 | 29 | 27 | 34 |

## Notes

- Primary gate: lexicographic authority comparator (feasible → hard → soft sources → default).
- Balance averages are a secondary gate when authority soft penalties are equal (no private rules in this phase).
- CandidateEvaluated / DurationMs are informational throughput metrics.
- Budget: {"maxInitialCandidates":120,"maxEvaluations":2500,"maxIterations":600,"maxDurationMs":2000,"stagnationLimit":120}

No merge. No deploy.
