# PROD-OPS-24H-01 — Clubs and Courts Verification

**Production SQL:** **NOT run** (boundary).  
**Public RPC smoke:** read-only anon RPC via baked Production SPA config — counts/names only; secrets not printed.  
**Evidence file:** `evidence/PUBLIC_RPC_SMOKE.json`

## Public routes

| Route | HTTP | Result |
|-------|------|--------|
| `/clubs` | 200 | PASS |
| `/courts` | 200 | PASS |

## Live public catalog counts vs certified evidence

| Surface | Certified (Experience Channels Final) | Live smoke (2026-07-27T16:04:54Z) | Match |
|---------|----------------------------------------|-------------------------------------|-------|
| Clubs | LIVE count **1** — `CLB ACCC` / `clb-accc` | count **1** — `CLB ACCC` | **YES** |
| Courts | LIVE count **4** — Sân 3–6 | count **4** — Sân 3, 4, 5, 6 | **YES** |
| Host | `expuvcohlcjzvrrauvud.supabase.co` | same | **YES** |

Prior publication smoke (`PORTAL_SMOKE.json`) also recorded clubs=1 / courts=4.

## Metadata / privacy on public RPC responses

Sensitive field name scan on RPC JSON (`email`, `phone`, `owner_id`, `tenant_id`, `service_role`, `password`, `created_by`, `internal_note`, `billing`, `stripe`): **all ABSENT**.

Observed allowlisted sample keys (Clubs): `description`, `display_name`, `id`, `image_url`, `location_summary`, `logo_url`, `public_contact`, `publication_state`, `slug`, `total_count`.

Observed allowlisted sample keys (Courts): `availability_descriptor`, `club_id`, `court_type`, `display_name`, `id`, `operational_state`, `publication_state`, `surface`, `total_count`, `venue_id`.

No unexpected internal auth/billing metadata observed in public RPC payloads.

## Clubs RLS contract tests

| Suite | Result |
|-------|--------|
| `tests/clubs-rls-remediation-01-policy-contract.test.js` | **PASS** 16/16 |

## Broad `status='active'` policy path

Repository contract tests assert forward remediation **drops** broad club-row `status='active'` discovery.  
Rollback SQL intentionally retains broad branch for Staging abort only.  
**No broad Production policy path reappears in repository contracts.**  
Live Production policy re-query: **NOT performed** (boundary) — carry-forward RESOLVED evidence from PR #318/#319 preserved.

## Fail-closed public catalog controls

| Check | HTTP | Message |
|-------|------|---------|
| Invalid sort | 400 | `INVALID_SORT: unsupported club sort` |
| Over-limit pagination | 400 | `INVALID_PAGINATION: limit must be between 1 and 50` |

Evidence: `evidence/FAILCLOSED_SMOKE.json`

## Marker

`PROD_OPS_24H_01_CLUBS_COURTS_VERIFICATION_RECORDED`
