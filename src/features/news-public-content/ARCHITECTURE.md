# News & Public Content — Architecture

## Phase

**NEWS-02 — Durable Persistence, SQL, RLS & Editorial Authorization**

Authored durable SQL + repository adapter + editorial authorization. SQL **NOT APPLIED**. Staging/Production unchanged. Public Portal not wired.

## Ownership

| Owner | Owns |
|-------|------|
| **News & Public Content** (`src/features/news-public-content/`) | Content domain, lifecycle, public projection, durable schema/SQL package, RLS policies, editorial capability matrix, repository adapter, typed persistence errors |
| **Experience Channels** | NewsPage, Public Portal rendering, routes, layouts |
| **Platform Core** | Result envelope, ISO clock, tenant/actor projection contracts (consume only); verified SQL helpers (`user_venue_id`, `user_has_permission`, `is_super_admin`) |

## Public import

```js
import {
  createNewsPublicContentFacade,
  createSupabaseContentRepository,
  getNews02CapabilityMatrix,
  authorizeNewsEditorialCapability,
  loadNews02SqlPackageManifest,
} from "../features/news-public-content/index.js";
```

## Layering

```
index.js                 ← single public facade / barrel
constants/               ← types, scopes, lifecycle, provenance, visibility, phase
errors/                  ← module-local typed errors
contracts/               ← references + review/approval/window/SEO/banner/sponsor
domain/                  ← aggregate, scope ownership, lifecycle, eligibility, revision
projections/             ← public read projection (fail-closed)
ports/                   ← ContentRepositoryPort + clock/id
application/             ← createNewsPublicContentFacade
platform/                ← Platform Core adoption (public barrel only)
authorization/           ← NEWS-02 editorial capability matrix (fail-closed)
persistence/             ← NEWS-02 SQL manifest + Supabase adapter (injected client)
```

## SQL package

Canonical path: `docs/news-public-content/news-02/` (Customer/CRM numbered convention).

Apply order: 10 → 20 → 30 → 40 → 50 → 60 (rollback 90 / verify 99 for NEWS-03).

**Status:** AUTHORED ONLY — not applied to Staging or Production.

## Persistence boundary

- Adapter: `createSupabaseContentRepository({ client })`
- Injected client only — no global singleton, no import-time network
- Implements `ContentRepositoryPort`
- Public read DB contract: RPC `news_public_content_query_public`
- Writes: trusted `service_role` / `news_public_content_save_aggregate` with `row_version` CAS

## Explicit non-goals (NEWS-02)

- Staging / Production SQL apply
- Public Portal UI / `NewsPage` / router / layouts
- Wiring `getPublicNews()` or replacing `MOCK_NEWS`
- Scheduler worker / media upload / CMS UI
- Declaring production-ready

## Follow-ups

- NEWS-03 — Staging Apply & Live Public Read Integration
- NEWS-04 — Public Portal Live Provenance Adoption
- NEWS-05 — Final Integration Certification & Closure
