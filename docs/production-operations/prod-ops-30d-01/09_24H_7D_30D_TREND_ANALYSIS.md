# PROD-OPS-30D-01 — 24H / 7D / 30D Trend Analysis

Trend tokens: `IMPROVING` | `STABLE` | `DEGRADING` | `INSUFFICIENT_DATA`

## Comparison basis

| Package | Tip SHA (fresh main at close) | Verdict |
|---------|-------------------------------|---------|
| PROD-OPS-24H | edca4577… (Gate 10) | PASS_WITH_OBSERVATIONS |
| PROD-OPS-7D | f52cfbf8… | PASS_WITH_OBSERVATIONS |
| PROD-OPS-30D | 6eff4c61… | PASS_WITH_OBSERVATIONS (this package) |

Calendar depth remains short → several trends are **INSUFFICIENT_DATA** for 30-day statistical confidence while observed-window behavior is **STABLE**.

## Trends

| Domain | 24H → 7D → 30D | Classification | Notes |
|--------|----------------|----------------|-------|
| Route availability | 200 → 200 → 200 | **STABLE** | No FAILED route smoke |
| Deployment parity | PASS → PASS → PASS | **STABLE** | Tip tracks Owner merges |
| Auth / RBAC | NOT_VERIFIED → VERIFIED_ENABLED → VERIFIED_ENABLED | **IMPROVING** then **STABLE** | Interactive login still NOT_EXERCISED |
| Tenant isolation | PASS contracts → PASS → PASS | **STABLE** | No exposure evidence |
| Public Catalog | Clubs1/Courts4 → same → same | **STABLE** | LIVE_EMPTY preserved |
| PWA | manifest/SW 200 → 200 → 200 | **STABLE** | |
| Monitoring | NOT_VERIFIED → PARTIALLY_EFFECTIVE → PARTIALLY_EFFECTIVE | **STABLE** | Not yet EFFECTIVE |
| Backups | Active prior cert → same → same | **INSUFFICIENT_DATA** | No independent dashboard series |
| Incidents | NEW_CRITICAL none → none → none | **STABLE** | No stop-condition events |
| Calendar continuity series | incomplete → incomplete → incomplete | **INSUFFICIENT_DATA** | A-CAL-01 OPEN; 30d series incomplete |

## Overall trend

```text
OVERALL_TREND=STABLE_WITH_INSUFFICIENT_CALENDAR_DEPTH
DEGRADING=NONE
```

## Marker

`PROD_OPS_30D_01_24H_7D_30D_TREND_ANALYSIS_RECORDED`
