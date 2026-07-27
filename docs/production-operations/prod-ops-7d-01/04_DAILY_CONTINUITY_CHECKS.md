# PROD-OPS-7D-01 — Daily Continuity Checks

**Load testing:** NOT performed.  
**Alias:** `https://pickvn.app`  
**Window note:** Constrained Production web continuity began at Gate 10 Production deploy `2026-07-27T15:44:11Z`. This package records all available checkpoints in the opening of the seven-day control window and establishes cadence for remaining days (see `09_30_DAY_OPERATIONS_HANDOFF.md`). Full seven calendar days of independent daily Ops captures are **not** all elapsed at package authorship; continuity for the observed interval is PASS.

## Checkpoint register

| Checkpoint | Timestamp (UTC) | Deploy SHA | Deploy ID | Routes | Anomaly ID |
|------------|-----------------|------------|-----------|--------|------------|
| 7D-CP-0 Gate10 | `2026-07-27T15:44:11Z` (deploy) / routes verified in 24H package | `edca4577…` | `5625433697` | All listed 200 (24H evidence) | none |
| 7D-CP-1 24H smoke | `2026-07-27T16:04:54Z` (RPC) / route 200s in 24H docs | `edca4577…` | `5625433697` | All listed 200 | none |
| 7D-CP-2 post-merge tip | `2026-07-27T16:24:49Z` deploy Ready | `f52cfbf8…` | `5626047618` | Tip advanced (docs merge); public shells remain Ready | none |
| 7D-CP-3 7D current | `2026-07-27T22:59:07Z` | `f52cfbf8…` | `5626047618` | All listed 200 | none |

Evidence file for CP-3: `evidence/ROUTE_CONTINUITY_CURRENT.json`.

## Per-route matrix (7D-CP-3 current)

| Route | Timestamp (UTC) | HTTP | Availability | Deploy SHA | Major visible error | Anomaly ID |
|-------|-----------------|------|--------------|------------|---------------------|------------|
| `/` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |
| `/clubs` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |
| `/courts` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |
| `/login` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |
| `/tournaments` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |
| `/rankings` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |
| `manifest.webmanifest` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |
| `sw.js` | 2026-07-27T22:59:07Z | 200 | YES | f52cfbf8… | none | none |

## Continuity verdict for observed window

```text
PUBLIC_ROUTE_CONTINUITY_OBSERVED_WINDOW=PASS
SEVEN_CALENDAR_DAY_DAILY_SERIES=INCOMPLETE_AT_AUTHORSHIP
REMAINING_DAILY_CHECKS=HANDED_TO_30D_CADENCE
```

## Marker

`PROD_OPS_7D_01_DAILY_CONTINUITY_CHECKS_RECORDED`
