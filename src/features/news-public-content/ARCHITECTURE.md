# News & Public Content — Architecture

## Phase

**NEWS-04 — Public Portal Live Provenance Adoption**

Public Portal news uses the canonical live News public-read path with honest provenance. Staging backend was certified in NEWS-03. Production remains blocked.

## Ownership

| Owner | Owns |
|-------|------|
| **News & Public Content** (`src/features/news-public-content/`) | Content domain, lifecycle, public projection, durable schema/SQL package, RLS policies, editorial capability matrix, repository adapter, typed persistence errors, provenance truth |
| **Experience Channels / Public Portal** | NewsPage, HomePage news section, `getPublicNews` orchestration, loading/error/empty, provenance badges, routes/layouts |
| **Platform Core** | Result envelope, ISO clock, tenant/actor projection contracts (consume only); verified SQL helpers |

## Public import

```js
import {
  createNewsPublicContentFacade,
  createSupabaseContentRepository,
  CONTENT_PROVENANCE,
} from "../features/news-public-content/index.js";
```

Portal wiring:

```js
import { getPublicNews } from "../features/public-portal/services/publicPortalService.js";
```

## Live public-read path (NEWS-04)

```
getPublicNews
  → createNewsPublicContentFacade
  → createSupabaseContentRepository({ preferRpc: true })
  → RPC news_public_content_query_public  (provenance = 'LIVE' only)
```

No silent mock fallback. Explicit `source: "mock" | "preview" | "live"` only.
PREVIEW must not cross the public RPC boundary (News-owned). Portal filter is defense in depth.

## SQL package

Canonical path: `docs/news-public-content/news-02/`

**Status:** Applied on Staging via NEWS-03. Production not applied.

## Persistence boundary

- Adapter: `createSupabaseContentRepository({ client })`
- Injected client only — no global singleton inside News module, no import-time network
- Public read DB contract: RPC `news_public_content_query_public`
- Writes: trusted `service_role` / save RPC (not used by Public Portal)

## Explicit non-goals (NEWS-04)

- Production SQL apply / Production Go
- Scheduler worker / media upload / CMS UI
- Claiming overall IMPLEMENTED / production-ready for `/news`

## Follow-ups

- NEWS-05 — Final Integration Certification & Closure
