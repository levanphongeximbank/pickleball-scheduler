# News & Public Content — Architecture (NEWS-01)

## Phase

**NEWS-01 — Domain, Editorial Lifecycle & Public Read Foundation**

Structural domain foundation only. No SQL, no Staging/Production, no Public Portal wiring.

## Ownership

| Owner | Owns |
|-------|------|
| **News & Public Content** (`src/features/news-public-content/`) | Content domain, identity, type/scope, editorial lifecycle, review/approval contracts, publication eligibility/window, public visibility, revisions/versioning, public read projection, SEO/category/tag/media/banner/sponsor reference contracts, LIVE/MOCK/PREVIEW content provenance, typed errors, repository ports, single public facade |
| **Experience Channels** | NewsPage, Public Portal rendering, routes, layouts, visual components, loading/error/empty/provenance presentation |
| **Platform Core** | Result envelope, ISO clock parse, tenant/actor projection contracts (consume only) |

## Public import

```js
import {
  createNewsPublicContentFacade,
  newsPublicContentFacade,
  CONTENT_TYPE,
  EDITORIAL_STATUS,
  CONTENT_PROVENANCE,
} from "../features/news-public-content/index.js";
```

Canonical facade factory: **`newsPublicContentFacade`** (alias of `createNewsPublicContentFacade`).

## Layering

```
index.js                 ← single public facade / barrel
constants/               ← types, scopes, lifecycle, provenance, visibility
errors/                  ← module-local typed errors
contracts/               ← references + review/approval/window/SEO/banner/sponsor
domain/                  ← aggregate, scope ownership, lifecycle, eligibility, revision
projections/             ← public read projection (fail-closed)
ports/                   ← ContentRepositoryPort + clock/id (no durable adapter)
application/             ← createNewsPublicContentFacade
platform/                ← Platform Core adoption (public barrel only)
```

## Persistence boundary

Repository **port** only. NEWS-01 does not ship SQL, Supabase adapters, localStorage, or production mock SoT. Test doubles belong in tests.

## Provenance boundary

News owns `CONTENT_PROVENANCE` (`LIVE` | `MOCK` | `PREVIEW`). Experience Channels owns presentation classification `PUBLIC_PORTAL_DATA_SOURCE` — related values, different ownership; News must not import Experience Channels.

## Explicit non-goals (NEWS-01)

- Public Portal UI / `NewsPage` / router / layouts
- Wiring `getPublicNews()` or replacing `MOCK_NEWS` purpose
- SQL / RLS / Staging / Production
- Scheduler worker / media upload
- Editing Competition / Venue / Club / CRM / Finance / Notification internals
- Declaring production-ready

## Follow-ups

- NEWS-02 — Durable Persistence, SQL, RLS & Editorial Authorization
- NEWS-03 — Staging Apply & Live Public Read Integration
- NEWS-04 — Public Portal Live Provenance Adoption
- NEWS-05 — Final Integration Certification & Closure
