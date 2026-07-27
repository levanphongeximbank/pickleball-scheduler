# PROD-OPS-30D-01 — 30-Day Continuity Register

**Load testing:** NOT performed.  
**Alias:** `https://pickvn.app`  
**Honesty rule:** Do **not** fabricate missing days. Classification tokens: `VERIFIED` | `MISSED` | `FAILED` | `NOT_VERIFIABLE`.

## Observation window honesty

Constrained Production web continuity began at Gate 10 deploy `2026-07-27T15:44:11Z`.  
At PROD-OPS-30D authorship (`~2026-07-27T23:32Z` UTC / 2026-07-28 morning VN), **fewer than seven calendar days** and **far fewer than thirty calendar days** have elapsed.

```text
THIRTY_CALENDAR_DAY_SERIES=INCOMPLETE_AT_AUTHORSHIP
SEVEN_CALENDAR_DAY_SERIES=INCOMPLETE_AT_AUTHORSHIP
A-CAL-01=OPEN
FABRICATED_DAYS=NONE
```

Future calendar days (not yet occurred) are classified **`NOT_VERIFIABLE`** (not `MISSED`).

## Verified checkpoints (actual evidence only)

| Date (UTC day) | Checkpoint | Timestamp (UTC) | Deploy ID | Deploy SHA | Routes | Status | Evidence source | Anomaly |
|----------------|------------|-----------------|-----------|------------|--------|--------|-----------------|---------|
| 2026-07-27 | 30D-CP-0 Gate10 | 15:44:11Z deploy / routes in 24H | 5625433697 | edca4577… | all 200 | **VERIFIED** | prod-ops-24h-01 | none |
| 2026-07-27 | 30D-CP-1 24H smoke | ~16:04Z | 5625433697 | edca4577… | all 200 | **VERIFIED** | prod-ops-24h-01 | none |
| 2026-07-27 | 30D-CP-2 24H tip | 16:24:49Z | 5626047618 | f52cfbf8… | Ready | **VERIFIED** | deploy metadata + 7D | none |
| 2026-07-27 | 30D-CP-3 7D smoke | 22:59:07Z | 5626047618 | f52cfbf8… | all 200 | **VERIFIED** | prod-ops-7d-01 evidence | none |
| 2026-07-27 | 30D-CP-4 tip after #324 | 23:23:45Z | 5631492629 | 6eff4c61… | Ready | **VERIFIED** | GitHub Deployments | none |
| 2026-07-27 | 30D-CP-5 30D current | 23:32:20Z | 5631492629 | 6eff4c61… | all 200 | **VERIFIED** | `evidence/ROUTE_CONTINUITY_CURRENT.json` | none |

Distinct UTC calendar days with ≥1 VERIFIED route smoke: **1** (`2026-07-27`).  
(VN local may show Jul 28 morning for CP-5; counted by UTC day of evidence timestamp.)

## Per-route matrix (30D-CP-5 current)

| Route | Date | Timestamp (UTC) | HTTP | Availability | Deploy ID | Deploy SHA | Visible error | Anomaly | Status |
|-------|------|-----------------|------|--------------|-----------|------------|---------------|---------|--------|
| `/` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |
| `/clubs` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |
| `/courts` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |
| `/login` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |
| `/tournaments` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |
| `/rankings` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |
| `manifest.webmanifest` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |
| `sw.js` | 2026-07-27 | 23:32:20Z | 200 | YES | 5631492629 | 6eff4c61… | none | none | VERIFIED |

## Days 2–30 (calendar) — not yet elapsed

| Calendar day index after Gate 10 start | Classification | Notes |
|----------------------------------------|----------------|-------|
| Days not yet occurred through Day 30 | **NOT_VERIFIABLE** | Must be filled by Ops cadence; do not backfill with invented HTTP results |
| Any past day with no Ops capture after it becomes due | **MISSED** | None yet declared MISSED at authorship (series still opening) |
| Any capture returning non-2xx material outage | **FAILED** | None observed |

## A-CAL-01 status

```text
A-CAL-01=OPEN
CLOSURE_CRITERIA=seven_actual_calendar_days_with_VERIFIED_route_smoke
VERIFIED_CALENDAR_DAYS_COUNT=1
```

A-CAL-01 may close **only** when seven actual calendar days are documented.

## Marker

`PROD_OPS_30D_01_30_DAY_CONTINUITY_REGISTER_RECORDED`
