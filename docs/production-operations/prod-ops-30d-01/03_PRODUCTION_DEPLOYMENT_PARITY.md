# PROD-OPS-30D-01 — Production Deployment Parity

**Boundary:** Agent does **not** redeploy Production.

## Observed Production deployments (constrained window)

| Deploy ID | Source SHA | origin/main at observe | Alias | Status | Parity | Observed (UTC) | Unexpected? |
|-----------|------------|------------------------|-------|--------|--------|----------------|--------------|
| 5625433697 | edca457748be3ef3a160b68076a69535b2ab6e3f | Gate 10 tip | pickvn.app | success | PARITY_PASS (vs then-main) | 2026-07-27T15:44:11Z | No — Gate 10 merge auto-deploy |
| 5626047618 | f52cfbf8bdf2f84aaf2a1bc398f3c2f2f11a39e7 | 24H merge tip | pickvn.app | success | PARITY_PASS | 2026-07-27T16:24:49Z | No — PR #323 docs merge |
| 5631492629 | 6eff4c61496734a418ce6a534fbdaf7bd3b10368 | 7D merge tip = fresh main | pickvn.app | success | PARITY_PASS | 2026-07-27T23:23:45Z | No — PR #324 docs merge |

## Current tip classification

```text
CURRENT_DEPLOYMENT_ID=5631492629
CURRENT_DEPLOYED_SHA=6eff4c61496734a418ce6a534fbdaf7bd3b10368
FRESH_ORIGIN_MAIN=6eff4c61496734a418ce6a534fbdaf7bd3b10368
PARITY=PARITY_PASS
UNEXPECTED_DEPLOYMENT=NONE
```

## Overall period classification

```text
PRODUCTION_DEPLOYMENT_PARITY=PARITY_PASS
```

No unknown / unauthorized Production deployments observed in this workstream. All tip advances are Owner-merged PR auto-deploys (docs/ops evidence).

## Marker

`PROD_OPS_30D_01_PRODUCTION_DEPLOYMENT_PARITY_RECORDED`
