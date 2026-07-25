# EC-04 List-Surface Data Honesty Report

## Safety baseline

- Worktree: `PICK_VN-Workstreams/experience-channels/experience-channels-04-public-portal-list-surface-data-honesty`
- Branch: `feature/experience-channels-04-public-portal-list-surface-data-honesty`
- Implemented on fresh `origin/main` containing EC-00 → EC-03
- Unrelated Coaching evidence `APPLY_REFUSED.json` present and left untouched

## Inventory

| Surface | Route | Page | Adapter | Source | Fallback | Ownership | Safe |
|---------|-------|------|---------|--------|----------|-----------|------|
| Tournaments | `/tournaments` | `TournamentsPage.jsx` | `getPublicTournamentsResult` | LIVE or MIXED | Mock retained | Public Portal (PRESENTATION_ONLY vs Competition detail) | Yes (list only) |
| Rankings | `/rankings` | `RankingsPage.jsx` | `getPublicRankingsResult` | MOCK (flag off) or LIVE/MIXED (flag on) | Mock retained | Public Portal presentation; VPR query consumed only | Yes (presentation only) |

## Silent-fallback findings (pre-fix)

1. `getPublicTournaments()` used `withFallback(live, MOCK_TOURNAMENTS, 3)` — mock presented without provenance.
2. `getPublicRankings()` silent `catch { }` then returned `MOCK_RANKINGS` — errors became successful mock data.
3. Pages treated arrays as success; no `PublicDataSourceNotice`.

## Architecture decision

- Reuse EC-03 `resolvePublicListDataResult` / `createMockResult` / `PublicDataSourceNotice`.
- New public-only file `publicTournamentsRankingsDataSource.js` (mirror EC-03 Clubs/Courts).
- Compatibility re-exports remain on `publicPortalService.js`.
- Do **not** edit Competition Engine, Ranking calculation engines, router, shell, or providers.
- Preserve mock fallback until certified live replacement exists.

## Exact file scope

- `src/features/public-portal/services/publicTournamentsRankingsDataSource.js` (new)
- `src/features/public-portal/services/publicPortalService.js`
- `src/pages/public/TournamentsPage.jsx`
- `src/pages/public/RankingsPage.jsx`
- `src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js`
- `src/features/experience-channels/public-portal/index.js`
- `src/features/experience-channels/index.js`
- `src/features/experience-channels/ARCHITECTURE.md`
- `docs/experience-channels/ec-04/**`
- `tests/experience-channels-ec-04-public-portal-list-surface-data-honesty.test.js`
- `tests/ui/tournaments-rankings-data-honesty.ui.test.jsx`
- `scripts/ci/unit-test-files.json`

## Competition collision

- `/tournament/:id/public` boundary remains `safeForRemediation: false` / Tournament Ops deferred.
- Adapter has no `competition-engine` imports.
- List page does not deep-link into operational tournament detail.

## Ranking business boundary

- Adapter maps canonical `queryPublicLeaderboard` rows only.
- UI displays `row.rank` / points as provided — no recalculation.
- Presentation filters (region/search) preserved; no tie-break or eligibility logic added.

## Explicit non-goals

Home, News, Clubs, Courts runtime changes; LIVE cutover; backend/SQL; Notification; PWA; Platform Core.
