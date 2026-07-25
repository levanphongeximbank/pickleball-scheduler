# NEWS-04 — Public Portal Live Provenance Adoption

## Status

Implemented in app code. Public RPC LIVE-only boundary authored (NEWS-04 remediation). Staging apply of remediation SQL **awaits Owner GO**. **Production not touched.** Closure deferred to NEWS-05.

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

- No Staging/Production **apply** in this remediation commit (authored SQL only; Owner GO required)
- No package/lockfile changes
- No Competition/Venue/Club/CRM/Finance/Notification internals
- No scheduler / media upload

## Staging / Production

- Staging backend: NEWS-03 certified; NEWS-04 LIVE-only RPC remediation **authored, not yet applied**
- Production: **not touched**; `productionBlocked: true`

## NEWS-05 exit criteria (next)

1. Owner GO + Staging apply of `10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql`
2. End-to-end Staging smoke of Public Portal `/news` against live RPC with real published LIVE content
3. Confirm PREVIEW/MOCK never appear from anonymous public RPC
4. Confirm MOCK only via explicit demo flag in portal
5. Production Go/No-Go checklist (env, RLS, anon path)
6. Final certification doc + close NEWS module GA gate (without over-claiming)
