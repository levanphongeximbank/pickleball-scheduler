# NEWS_04_ARCHITECTURE_DECISION

## Verdict

Adopt the canonical live News public-read path for Public Portal news, with honest provenance and **no silent mock fallback**.

## Canonical integration point

`src/features/public-portal/services/publicNewsService.js` → `getPublicNews()`

Re-exported from `publicPortalService.js` for existing call sites.

## Live path

```
NewsPage / HomePage
  → getPublicNews()
  → createNewsPublicContentFacade
  → createSupabaseContentRepository({ preferRpc: true })
  → RPC news_public_content_query_public
  → sanitized public candidates
  → portal card mapping (no editorial leak)
```

## Live data source

- Injected browser anon client via `getSupabaseAuthClient()` (`src/auth/supabaseClient.js`)
- Config gate via `hasSupabaseConfig()` / `getSupabaseConfigError()`
- No `service_role`, no hardcoded URL/key, no import-time network, no direct base-table query from portal

## Mock usage boundary

- `MOCK_NEWS` retained for explicit `source: "mock"` / `VITE_PUBLIC_NEWS_SOURCE=mock`, tests, demos
- Live failure / missing config / network / RLS **must not** return mock items
- Mock success is labeled `provenance: MOCK` and never `LIVE`

## Provenance contract

| Value | When |
|-------|------|
| `LIVE` | Successful canonical live RPC/facade path (`provenance = 'LIVE'` at SQL boundary) |
| `MOCK` | Explicit mock/demo/test mode only |
| `PREVIEW` | Explicit preview/editorial mode only (never via public RPC) |

Unknown provenance → typed error (fail closed).

**Public backend boundary (News-owned):** `news_public_content_query_public` requires `provenance = 'LIVE'`. PREVIEW/MOCK must not cross into the browser via that RPC.

**Defense in depth (Experience Channels):** portal live path also skips PREVIEW if a stale/injected source still surfaces it — not the primary control.

## Error behavior

Result envelope always returned (never bare array):

- `status`: `ok` | `empty` | `error`
- `items`, `provenance`, `source`, `error`, `fetchedAt`, `isEmpty`, `diagnostics`

Typed portal codes: config missing, network, RPC, permission, malformed, unsupported provenance, client unavailable.

User-facing messages are safe; no tokens/keys/SQL/session in logs or diagnostics.

## Empty behavior

Live success with zero published items → `status: empty`, `provenance: LIVE`, `items: []`.

## Preview behavior

Only when `source: "preview"` (or env override). Not default on public production route. UI badge required. Must not leak as LIVE.

## Environment behavior

Default source = **live**. Explicit override via options or `VITE_PUBLIC_NEWS_SOURCE`. Missing Vite Supabase config → configuration error (not mock).

## Ownership split

| Owner | Owns |
|-------|------|
| News & Public Content | Public read facade/repository, provenance truth, publication eligibility, public projection contract |
| Experience Channels / Public Portal | `getPublicNews` orchestration, NewsPage/HomePage presentation, loading/error/empty, provenance badges |

News module does **not** own UI/routes. Portal does **not** invent business truth from mock on live path.

## Files expected to change

- `src/features/public-portal/services/publicNewsService.js` (new)
- `src/features/public-portal/services/publicPortalService.js`
- `src/pages/public/NewsPage.jsx`
- `src/pages/public/HomePage.jsx`
- `src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js`
- `src/features/news-public-content/constants/index.js` (phase flags)
- docs under `docs/news-public-content/news-04/`
- targeted tests + `scripts/ci/unit-test-files.json`

## Files forbidden

- NEWS-02/03 SQL/RLS packages
- Staging/Production apply
- `package.json` / lockfile
- Competition / Venue / Club / CRM / Finance / Notification internals
- Router/layout outside news presentation needs
- Scheduler / media upload
