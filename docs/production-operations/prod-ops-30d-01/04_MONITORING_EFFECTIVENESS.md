# PROD-OPS-30D-01 — Monitoring Effectiveness

**Boundary:** Read-only. Do not claim EFFECTIVE merely because log surfaces exist. No PII/secrets from logs.

## Final classification (exactly one)

```text
MONITORING_PARTIALLY_EFFECTIVE
```

## Evaluation matrix

| Surface | Method | Result |
|---------|--------|--------|
| Vercel runtime logs (dashboard) | CLI/project not linked; no Owner IR dashboard export in this package | **NOT independently reviewed** |
| HTTP 5xx (public smoke) | Live GET of public routes + PWA assets | **None observed** (all 200) |
| Authentication errors | Interactive Production login not exercised | No auth-error telemetry claimed |
| Supabase connectivity (public catalog) | Anon RPC clubs/courts | 200; fail-closed 400 on invalid inputs |
| Public Catalog errors | Shells 200; RPC healthy | No material failure |
| Asset-loading / SW failures | manifest + sw.js 200 | No failure observed |
| Error-detection latency | Manual smoke only | Detects total outage at smoke time; not continuous |
| Incident owner / escalation | PGO-02 + Gate 10 / 7D handoff | Documented; live roster FOLLOW_UP |
| Log retention | Not independently re-attested | **NOT_VERIFIED** |
| Ability to identify affected route + timestamp | Manual smoke evidence includes route + UTC timestamp | **PASS for smoke path** |

## Why not MONITORING_EFFECTIVE

A material issue could be **partially** detected via Ops smoke cadence and public HTTP status, but automated alerting, continuous error-rate ownership, and retention SSOT remain unverified. Therefore EFFECTIVE is **not** warranted.

## Why not INADEQUATE / NOT_VERIFIED

Manual public detectability remains proven across 24H → 7D → 30D checkpoints; escalation path documented. Classification remains **PARTIALLY_EFFECTIVE** (stable vs 7D).

```text
AUTOMATED_IR_EFFECTIVENESS=NOT_VERIFIED
MANUAL_PUBLIC_SMOKE_DETECTABILITY=PASS
MONITORING_CLASSIFICATION=MONITORING_PARTIALLY_EFFECTIVE
```

## Marker

`PROD_OPS_30D_01_MONITORING_EFFECTIVENESS_RECORDED`
