# PROD-OPS-7D-01 — Clubs, Courts, and Public Catalog

**Production data:** **NOT modified**.  
**Production SQL writes:** **NONE**.  
**Evidence:** `evidence/PUBLIC_RPC_SMOKE.json`, `evidence/FAILCLOSED_SMOKE.json`.

## Live public counts (anon RPC)

| Surface | Expected (certified) | Live (2026-07-27T22:59:05Z) | Match |
|---------|----------------------|-----------------------------|-------|
| Clubs | 1 — `CLB ACCC` | 1 — `CLB ACCC` | YES |
| Courts | 4 — Sân 3–6 | 4 — Sân 3, 4, 5, 6 | YES |
| Host | `expuvcohlcjzvrrauvud.supabase.co` | same | YES |

## Visibility / privacy

Sensitive field name scan on public RPC JSON (`email`, `phone`, `owner_id`, `tenant_id`, `service_role`, `password`, `created_by`, `internal_note`, `billing`, `stripe`): **all ABSENT**.

No internal auth/billing metadata exposure observed on public DTO keys.

## Contract tests (Phase I execution)

| Suite | Expected |
|-------|----------|
| Clubs RLS remediation policy contracts | PASS (run in Phase I) |
| Public Catalog focused suites | PASS (run in Phase I) |

## Tournaments / Rankings posture

| Surface | Shell HTTP | Live data posture |
|---------|------------|-------------------|
| `/tournaments` | 200 | **LIVE_EMPTY** (certified honest-empty; no new certified populated dataset) |
| `/rankings` | 200 | **LIVE_EMPTY** (certified honest-empty; no new certified populated dataset) |

No unauthorized activation claims. No whole-platform GA claim.

## Fail-closed public catalog controls (live)

| Check | HTTP | Message |
|-------|------|---------|
| Invalid sort | 400 | `INVALID_SORT: unsupported club sort` |
| Over-limit pagination | 400 | `INVALID_PAGINATION: limit must be between 1 and 50` |

## Marker

`PROD_OPS_7D_01_CLUBS_COURTS_PUBLIC_CATALOG_RECORDED`
