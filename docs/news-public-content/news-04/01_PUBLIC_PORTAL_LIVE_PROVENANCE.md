# NEWS-04 — Public Portal Live Provenance Adoption

## Status

Implemented in app code. Staging backend already certified in NEWS-03. **Production not touched.** Closure deferred to NEWS-05.

## Live path

See `00_NEWS_04_ARCHITECTURE_DECISION.md`.

## Provenance rules

- **LIVE** — only successful canonical Supabase public RPC path
- **MOCK** — only explicit mock/demo/test mode; visible badge
- **PREVIEW** — only explicit preview mode; never default public production; never relabeled LIVE
- Unknown provenance — fail closed

## Mock / preview boundaries

- `MOCK_NEWS` kept for tests/demo/explicit mock
- Live errors never return mock
- Preview filtered from live public results

## Error / empty

- Envelope: status / items / provenance / source / error / fetchedAt / isEmpty / diagnostics
- Empty live list is success-empty with LIVE provenance
- Errors are typed; user messages are non-sensitive

## Supabase client boundary

- `getSupabaseAuthClient()` anon/public-safe only
- Config missing → `PUBLIC_NEWS_CONFIG_MISSING`
- No service_role in frontend

## Ownership

- News: data contract, facade, repository, provenance truth
- Experience Channels: NewsPage, portal orchestration, presentation states

## Tests

- `tests/news-public-content-news-04-public-portal-live.test.js`
- `tests/news-public-content-news-04-portal-ui.test.js`
- NEWS-01/02/03 + Experience Channels + portal regression via unit suite

## Explicit exclusions

- No SQL/RLS edits
- No Staging/Production apply in this workstream
- No package/lockfile changes
- No Competition/Venue/Club/CRM/Finance/Notification internals
- No scheduler / media upload

## Staging / Production

- Staging backend: already certified (NEWS-03)
- Production: **not touched**; `productionBlocked: true`

## NEWS-05 exit criteria (next)

1. End-to-end Staging smoke of Public Portal `/news` against live RPC with real published LIVE content
2. Confirm PREVIEW never appears on anonymous public production route
3. Confirm MOCK only via explicit demo flag
4. Production Go/No-Go checklist (env, RLS, anon path)
5. Final certification doc + close NEWS module GA gate (without over-claiming)
