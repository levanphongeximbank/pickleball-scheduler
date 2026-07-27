# PROD-OPS-24H-01 — Public Route Continuity

**Observed (UTC):** `2026-07-27T15:55:58Z` (primary probe)  
**Deployed SHA under alias:** `edca457748be3ef3a160b68076a69535b2ab6e3f` (parity PASS)  
**Method:** `curl` HTTP status / redirect / size — **no load testing**

## Results

| Route | HTTP (no-follow) | Follow | Redirect | Bytes (approx) | Availability |
|-------|------------------|--------|----------|----------------|--------------|
| `https://pickvn.app/` | 200 | 200 | none | 6543 | PASS |
| `https://pickvn.app/clubs` | 200 | 200 | none | 6543 | PASS |
| `https://pickvn.app/courts` | 200 | 200 | none | 6543 | PASS |
| `https://pickvn.app/manifest.webmanifest` | 200 | 200 | none | 644 | PASS |
| `https://pickvn.app/sw.js` | 200 | 200 | none | 27882 | PASS |
| `https://pickvn.app/login` | 200 | 200 | none | 6543 | PASS (SPA shell) |
| `https://pickvn.app/tournaments` | 200 | 200 | none | 6543 | PASS (SPA shell) |
| `https://pickvn.app/rankings` | 200 | 200 | none | 6543 | PASS (SPA shell) |

## SPA shell notes

- `/`, `/clubs`, `/courts` share identical HTML shell SHA256  
  `A1A073C058D0930A35A6B536D28EF5A20872D2EC367807BD33E872F5F421DE4F`
- Expected for client-side router; runtime data comes from public RPC after JS boot.
- Index bundle observed: `/assets/index-CpJ-wSSC.js`
- Title/meta: Pickleball Scheduler Pro; `#root` present.

## Console / runtime errors

Browser DevTools console was **not** captured in this read-only HTTP probe.  
No server-side 5xx observed on approved public routes.  
JS runtime errors: **NOT_OBSERVED** (tooling limitation — not claimed absent).

## HTML secret scan (shell)

| Pattern class | Result |
|---------------|--------|
| `service_role` / service role markers | ABSENT |
| JWT-like in HTML shell | 0 |
| `sk_live` / `sk_test` / private key markers | ABSENT |

Anon key lives in JS bundle (expected for Supabase client); **not printed**.

## Deployed SHA parity

```text
PUBLIC_ROUTE_DEPLOY_SHA_PARITY=PASS
```

## Marker

`PROD_OPS_24H_01_PUBLIC_ROUTE_CONTINUITY_RECORDED`
