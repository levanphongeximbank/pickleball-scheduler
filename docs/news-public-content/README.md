# News & Public Content

Business Module workstreams for editorial content domain and public read models.

| Workstream | Status |
|------------|--------|
| NEWS-01 — Domain, Editorial Lifecycle & Public Read Foundation | Complete (foundation) |
| NEWS-02 — Durable Persistence, SQL, RLS & Editorial Authorization | Applied on Staging via NEWS-03 |
| NEWS-03 — Staging Apply & Live Public Read Integration | Staging applied + live certified — see `NEWS_03_STAGING_CERTIFICATION.md` |
| NEWS-04 — Public Portal Live Provenance Adoption | Complete (portal live path + provenance; Staging LIVE-only RPC certified) |
| NEWS-05 — Final Integration Certification & Closure | Certification packet authored — see `news-05/`; Production **not** deployed |

Canonical module: `src/features/news-public-content/`

Public facade: `newsPublicContentFacade` / `createNewsPublicContentFacade` via `src/features/news-public-content/index.js`

Portal adoption (NEWS-04): `src/features/public-portal/services/publicNewsService.js` → `getPublicNews()`

SQL package (NEWS-02): `docs/news-public-content/news-02/`

Permission seed + Staging harness (NEWS-03): `docs/news-public-content/news-03/` + `scripts/news/news-03-staging-rollout.mjs` + `scripts/news/news-03-staging-live-certify.mjs`

NEWS-04 docs: `docs/news-public-content/news-04/`

Public RPC LIVE-only remediation: `docs/news-public-content/news-04/03_PUBLIC_RPC_LIVE_ONLY_REMEDIATION.md` (**Applied on Staging** + live certified; see `NEWS_04_STAGING_PUBLIC_RPC_CERTIFICATION.md`)

NEWS-05 docs: `docs/news-public-content/news-05/`

Architecture decision: `docs/news-public-content/news-04/00_NEWS_04_ARCHITECTURE_DECISION.md`

## Production

Production project `expuvcohlcjzvrrauvud`: News schema **ABSENT** (NEWS-05 read-only inventory). No Production apply without separate Owner GO.
