# PROD-OPS-30D-01 — Clubs, Courts, and Public Catalog

**Production data:** **NOT modified**.  
**Evidence:** `evidence/PUBLIC_RPC_SMOKE.json`, `evidence/FAILCLOSED_SMOKE.json`.

## Live public counts

| Surface | Expected | Live (2026-07-27T23:32:20Z) | Match |
|---------|----------|-----------------------------|-------|
| Clubs | 1 — `CLB ACCC` | 1 — `CLB ACCC` | YES |
| Courts | 4 — Sân 3–6 | 4 — Sân 3, 4, 5, 6 | YES |
| Duplicates / missing | none | none observed | YES |

## Privacy

Sensitive field scan (`email`, `phone`, `owner_id`, `tenant_id`, `service_role`, `password`, `created_by`, `internal_note`, `billing`, `stripe`): **all ABSENT**.

## Tournaments / Rankings

| Surface | Shell | Posture |
|---------|-------|---------|
| `/tournaments` | 200 | **LIVE_EMPTY** |
| `/rankings` | 200 | **LIVE_EMPTY** |

No unauthorized activation. No whole-platform GA claim.

## PWA

| Asset | HTTP |
|-------|------|
| `manifest.webmanifest` | 200 |
| `sw.js` | 200 |

## Marker

`PROD_OPS_30D_01_CLUBS_COURTS_PUBLIC_CATALOG_RECORDED`
