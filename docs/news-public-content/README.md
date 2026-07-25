# News & Public Content

Business Module workstreams for editorial content domain and public read models.

| Workstream | Status |
|------------|--------|
| NEWS-01 — Domain, Editorial Lifecycle & Public Read Foundation | Complete (foundation) |
| NEWS-02 — Durable Persistence, SQL, RLS & Editorial Authorization | Applied on Staging via NEWS-03 |
| NEWS-03 — Staging Apply & Live Public Read Integration | Staging applied + live certified — see `NEWS_03_STAGING_CERTIFICATION.md` |
| NEWS-04 — Public Portal Live Provenance Adoption | Not started |
| NEWS-05 — Final Integration Certification & Closure | Not started |

Canonical module: `src/features/news-public-content/`

Public facade: `newsPublicContentFacade` / `createNewsPublicContentFacade` via `src/features/news-public-content/index.js`

SQL package (NEWS-02): `docs/news-public-content/news-02/`

Permission seed + Staging harness (NEWS-03): `docs/news-public-content/news-03/` + `scripts/news/news-03-staging-rollout.mjs` + `scripts/news/news-03-staging-live-certify.mjs`

Architecture decision: `docs/news-public-content/news-03/NEWS_03_PERMISSION_AND_ROLLOUT_ARCHITECTURE_DECISION.md`

Runbook: `docs/news-public-content/news-03/NEWS_03_STAGING_APPLY_RUNBOOK.md`

Certification: `docs/news-public-content/news-03/NEWS_03_STAGING_CERTIFICATION.md`
