# PUBLIC-CATALOG-01 — Readiness Certification Evidence

## Verdict (pre-merge)

Remote public read **contracts** for Clubs and Courts are implemented and unit-certified in-repo.

| Gate | Clubs | Courts |
|------|-------|--------|
| Remote public source exists (module + RPC contract) | YES | YES |
| No private auth required for read API | YES | YES |
| Deny-by-default public-safe DTO | YES | YES |
| No mock fallback on remote failure | YES | YES |
| Pagination bounded + deterministic order | YES | YES |
| Typed error on network/RPC failure | YES | YES |
| Independent failure isolation | YES | YES |
| SQL package authored | YES | YES |
| SQL applied to Staging/Production | **YES (Staging only — PUBLIC-CATALOG-01S)** / **NO (Production)** | **YES (Staging only — PUBLIC-CATALOG-01S)** / **NO (Production)** |
| Public Portal cutover | **NO** | **NO** |

## EC-06 re-evaluation note

After Owner merges this PR **and** Staging applies `10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql` with verification, Experience Channels can re-score Gates 1 / 5 / 11 for `public-clubs` / `public-courts`. This workstream does **not** flip EC-06 cutover classifications.

## Clubs remote source certified (code contract)

YES — `listPublicClubs` + `public_catalog_list_clubs` contract + projector denylist tests.

## Courts remote source certified (code contract)

YES — `listPublicCourts` + `public_catalog_list_courts` contract + projection-table boundary + projector denylist tests.

## Environment apply

- Staging: **applied & verified** in PUBLIC-CATALOG-01S (`qyewbxjsiiyufanzcjcq`) — see `docs/public-catalog/pc-01/staging-activation/`
- Production: **not applied**
- Public Portal cutover: **NO**
