# PUBLIC-PORTAL-01C — Clubs & Courts Staging Cutover Certification

## Owner authorization

- `STAGING_READONLY_CUTOVER_GO=YES`
- `STAGING_DATA_MUTATION_GO=NO`
- `PRODUCTION_GO=NO`

## Staging target

- Project ref: `qyewbxjsiiyufanzcjcq`
- Production blocklist: `expuvcohlcjzvrrauvud`
- MCP: `supabase-staging` only (read-only verification)

## Architecture decision

Reuse EC-02 presentation states, EC-03 `PublicDataResult` / provenance, EC-03/04 `PublicDataSourceNotice`, and PUBLIC-CATALOG-01 remote adapters.

Staging-only runtime selection (News-style narrow env):

```
VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote
```

- Default / Production: `local` (existing EC-03 local blob + honest MIXED mock fallback).
- Staging remote: Clubs → `public_catalog_list_clubs`; Courts → `public_catalog_list_courts`.
- Remote success (including `[]`) → LIVE provenance; empty → EMPTY; error → ERROR.
- Remote error never falls back to mock.
- `productionReady` forced `false` until a separate Production rollout certification.
- Home / Tournaments / Rankings / News are **not** cut over in this slice.

## Exact file scope

| Path | Role |
|------|------|
| `src/features/public-portal/services/publicClubsCourtsDataSource.js` | Source selector + remote loaders |
| `src/pages/public/ClubsPage.jsx` | Async load + loading/empty/error |
| `src/pages/public/CourtsPage.jsx` | Async load + loading/empty/error |
| `src/features/public-portal/services/publicPortalService.js` | Exports |
| `src/features/experience-channels/public-portal/data-source/publicDataResult.js` | `productionReady: false` override |
| `src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js` | Notes / loading readiness |
| `src/features/experience-channels/public-portal/certification/liveCutoverCertificationMatrix.js` | Staging note; Production still uncertified |
| `tests/public-portal-01c-*.test.js` | Targeted gates |
| `tests/public-catalog-01-sql-boundary.test.js` | Portal wiring assertion update |
| `tests/experience-channels-ec-03-*.test.js` / `ec-06-*.test.js` | Regression updates |
| `scripts/ci/unit-test-files.json` | Register 01C test |
| `docs/public-portal/public-portal-01c/**` | Readiness + evidence |

## Rollback / disable

Unset or set `VITE_PUBLIC_CLUBS_COURTS_SOURCE=local` and redeploy Staging preview. Production remains local by default without the env flag.

## Evidence

See `docs/public-portal/public-portal-01c/evidence/`.

Positive publication proof references immutable PC-01E evidence (seed rolled back; current Staging public rows = 0).
