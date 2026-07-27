# PROD-OPS-7D-01 — Monitoring and Logging

**Boundary:** Read-only observation. Do not claim effectiveness merely because log surfaces exist.  
**No PII / secrets printed from logs.**

## Monitoring classification (exactly one)

```text
MONITORING_PARTIALLY_EFFECTIVE
```

## What was evaluated

| Surface | Observation method | Result |
|---------|-------------------|--------|
| Vercel runtime logs (dashboard) | CLI/project not linked; dashboard not independently accessed with IR SSOT | **NOT independently reviewed** |
| Error rates / 5xx dashboards | Not independently readable in this worktree | **NOT_VERIFIED** as automated metric |
| HTTP 5xx on public routes (smoke) | Live GET `/`, `/clubs`, `/courts`, `/login`, `/tournaments`, `/rankings`, manifest, `sw.js` | **None observed** (all 200) |
| Authentication errors (Production interactive) | Credential login not performed | No auth-error telemetry claimed |
| Supabase connectivity (public catalog path) | Anon public RPC clubs/courts | HTTP 200; fail-closed 400 on invalid inputs |
| Public Catalog failures | Route shells 200; RPC healthy for Clubs/Courts | No material failure observed |
| Asset / service-worker failures | `manifest.webmanifest` + `sw.js` HTTP 200 | No SW fetch failure observed |
| Incident alert ownership | Carry-forward PGO-02 + Gate 10; live IR roster still FOLLOW_UP | Ownership model documented; automated alert effectiveness **not** proven |
| Log retention evidence | Not independently re-attested this window | **NOT_VERIFIED** |

## Why PARTIALLY_EFFECTIVE (not EFFECTIVE / not INADEQUATE)

1. **Effective enough for constrained continuity:** repeated public smoke + public RPC checks can detect material public outage / catalog breakage (manual Ops control).
2. **Not fully effective:** automated alerting, runtime error-rate ownership, and log-retention SSOT remain **not independently verified** (`RC-MONITOR-01` residual).
3. **Not inadequate:** no evidence that monitoring is absent to the point of requiring `PAUSE_PRODUCTION_WEB`; cadence + Owner escalation still available.

```text
AUTOMATED_IR_EFFECTIVENESS=NOT_VERIFIED
MANUAL_PUBLIC_SMOKE_DETECTABILITY=PASS
MONITORING_CLASSIFICATION=MONITORING_PARTIALLY_EFFECTIVE
```

## Incident ownership (unchanged pointers)

| Role | Authority |
|------|-----------|
| Owner | Production GO / escalation / rollback authorization |
| Ops | Public smoke / dashboard review |
| Security | Tenant-isolation incidents (CRITICAL until disproven) |

Rollback remains Owner-authorized only (agent does not execute).

## Marker

`PROD_OPS_7D_01_MONITORING_AND_LOGGING_RECORDED`
