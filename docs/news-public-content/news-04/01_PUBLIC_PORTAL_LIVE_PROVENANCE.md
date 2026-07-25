# NEWS-04 — Public Portal Live Provenance Adoption

## Status

Implemented in app code. Public RPC LIVE-only boundary authored and **applied + live certified on Staging** (see `NEWS_04_STAGING_PUBLIC_RPC_CERTIFICATION.md`). **Production not touched.** Final certification / GO decision: NEWS-05.

## Live path

See `00_NEWS_04_ARCHITECTURE_DECISION.md`.

## Provenance rules

- **LIVE** — only successful canonical Supabase public RPC path (`provenance = 'LIVE'`)
- **MOCK** — only explicit mock/demo/test mode; visible badge
- **PREVIEW** — only explicit preview mode; **never** returned by public RPC; never relabeled LIVE
- Unknown provenance — fail closed

## Public backend boundary

News owns eligibility/visibility/provenance at `news_public_content_query_public`.
See `03_PUBLIC_RPC_LIVE_ONLY_REMEDIATION.md` (classified **PUBLIC_BOUNDARY_DEFECT**; remediated in authored SQL + adapter).

Portal PREVIEW skip is defense in depth only.

## Mock / preview boundaries

- `MOCK_NEWS` kept for tests/demo/explicit mock
- Live errors never return mock
- PREVIEW must not appear from public RPC; portal also skips PREVIEW on live source as backup

## Error / empty

- Envelope: status / items / provenance / source / error / fetchedAt / isEmpty / diagnostics
- Empty live list is success-empty with LIVE provenance
- Errors are typed; user messages are non-sensitive

## Supabase client boundary

- `getSupabaseAuthClient()` anon/public-safe only
- Config missing → `PUBLIC_NEWS_CONFIG_MISSING`
- No service_role in frontend

## Ownership

- News: data contract, facade, repository, provenance truth, public RPC eligibility
- Experience Channels: NewsPage, portal orchestration, presentation states

## Tests

- `tests/news-public-content-news-04-public-portal-live.test.js`
- `tests/news-public-content-news-04-portal-ui.test.js`
- `tests/news-public-content-news-04-public-rpc-boundary.test.js`
- NEWS-01/02/03 + Experience Channels + portal regression via unit suite

## Explicit exclusions

- No Production **apply** in NEWS-04 (Owner GO required for any Production write)
- Staging LIVE-only apply was performed under Owner GO `NEWS_04_OWNER_GO_STAGING_PUBLIC_RPC_LIVE_ONLY` (separate certify step)
- No package/lockfile changes
- No Competition/Venue/Club/CRM/Finance/Notification internals
- No scheduler / media upload

## Staging / Production

- Staging backend: NEWS-03 certified; NEWS-04 LIVE-only RPC remediation **applied + live certified** — see `NEWS_04_STAGING_PUBLIC_RPC_CERTIFICATION.md`
- Production: **not touched**; `productionBlocked: true`

## NEWS-05 exit criteria (completed in NEWS-05 packet)

1. ~~Owner GO + Staging apply of LIVE-only SQL~~ — done (Staging certified)
2. Staging live recert + public boundary matrix — NEWS-05 harness PASS
3. Confirm PREVIEW/MOCK never appear from anonymous public RPC — PASS on Staging
4. Confirm MOCK only via explicit portal source — PASS (unit)
5. Production Go/No-Go checklist — `PRODUCTION_GO_WITH_CONDITIONS` (News ABSENT on Production)
6. Final certification docs — `docs/news-public-content/news-05/` (implementation complete; Production not deployed)
