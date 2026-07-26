# EC-05 — Home Data-Source Honesty Report

## Safety baseline

- Worktree: `PICK_VN-Workstreams/experience-channels/experience-channels-05-public-portal-home-data-source-honesty`
- Branch: `feature/experience-channels-05-public-portal-home-data-source-honesty`
- Base: fresh `origin/main`

## Home section inventory

| Section | Component | Service/Adapter | Source | Fallback | Status model | Ownership | Safe remediation |
|---------|-----------|-----------------|--------|----------|--------------|-----------|------------------|
| Hero | `HeroSection` | none | static | none | n/a | Public Portal | NO_CHANGE_REQUIRED |
| Stats | `StatsSection` | `getPublicHomeStatsResult` | LIVE local blob or MOCK | mock when no clubs | EC-03 result | Public Portal | IMPLEMENT |
| Featured tournaments | `TournamentCard` | `getPublicHomeFeaturedTournamentsResult` → EC-04 | LIVE/MIXED/MOCK | mock min-3 | EC-03 result | Public Portal | WRAP_ONLY |
| Live scores hub | `LiveDataHubSection` | `getPublicHomeLiveScoresResult` | MOCK | none | EC-03 result | Public Portal | REMOVE_FALSE_CLAIM |
| Schedule hub | `LiveDataHubSection` | `getPublicHomeScheduleResult` | MOCK | none | EC-03 result | Public Portal | REMOVE_FALSE_CLAIM |
| Results hub | `LiveDataHubSection` | `getPublicHomeResultsResult` | MOCK | none | EC-03 result | Public Portal | REMOVE_FALSE_CLAIM |
| Featured clubs | `ClubCard` | `getPublicHomeFeaturedClubsResult` → EC-03 | LIVE/MIXED/MOCK | mock min-3 | EC-03 result | Public Portal | WRAP_ONLY |
| Featured courts | `CourtCard` | `getPublicHomeFeaturedCourtsResult` → EC-03 | LIVE/MIXED/MOCK | mock min-2 | EC-03 result | Public Portal | WRAP_ONLY |
| Upcoming events | Home inline | `getPublicHomeUpcomingEventsResult` | MOCK | none | EC-03 result | Public Portal | REMOVE_FALSE_CLAIM |
| News/media | Home inline | `projectHomeNewsSection` ← NEWS-04 | LIVE/MOCK/PREVIEW | no silent mock | EC-03 projection | Public Portal + News | WRAP_ONLY |
| Sponsors | Home inline | `getPublicHomeSponsorsResult` | MOCK | none | EC-03 result | Public Portal | WRAP_ONLY |
| CTA | Home inline | none | static | none | n/a | Public Portal | NO_CHANGE_REQUIRED |

## Silent-fallback findings (pre-fix)

1. Home stripped EC-03/04 provenance by calling array getters.
2. `getPublicStats()` silently substituted `PUBLIC_STATS` mock.
3. Stats fabricated `|| 1` minimums.
4. News errors flattened via `getPublicNewsItemsOrEmpty` → blank grid.
5. LiveDataHub hard-coded match fallback + “LIVE SCORE” / “HÔM NAY” / “MỚI NHẤT”.
6. Direct `MOCK_UPCOMING_EVENTS` import without notice.

## Architecture decision

- One Home orchestration adapter (`publicHomeDataSource.js`) projecting section Results.
- Reuse EC-03 contract + EC-03/04 list adapters; map NEWS-04 without a second news contract.
- Section isolation: one section error does not rewrite others.
- Caller-controlled retry via `retryToken` (no infinite retry).
- Keep mock content; remove false-live claims.

## Exact file scope

- `src/features/public-portal/services/publicHomeDataSource.js` (new)
- `src/pages/public/HomePage.jsx`
- `src/components/public/sections/LiveDataHubSection.jsx`
- `src/features/public-portal/services/publicPortalService.js` (additive re-exports)
- `src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js`
- `src/features/experience-channels/public-portal/index.js`
- `src/features/experience-channels/index.js`
- `src/features/experience-channels/ARCHITECTURE.md`
- `docs/experience-channels/ec-05/**`
- `tests/experience-channels-ec-05-public-portal-home-data-source-honesty.test.js`
- `tests/news-public-content-news-04-portal-ui.test.js` (Home assertion update)
- `scripts/ci/unit-test-files.json`

## Explicit non-goals

- No backend contract change
- No Competition Engine change
- No Ranking calculation change
- No SQL/Supabase
- No router/shell/provider/PWA
- No LIVE cutover

## Rollback

Revert the EC-05 commit / close the PR branch. Home returns to array-getter + unlabeled mock hub presentation.
