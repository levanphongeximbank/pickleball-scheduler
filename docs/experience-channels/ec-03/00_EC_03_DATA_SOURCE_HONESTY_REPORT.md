# EC-03 Data-Source Honesty Report

**Workstream:** EC-03 — PUBLIC PORTAL DATA-SOURCE HONESTY  
**Branch:** `feature/experience-channels-03-public-portal-data-source-honesty`  
**Baseline:** fresh `origin/main` (post EC-02)

## Architecture decision

Implement **Priority A** (canonical PublicDataResult / provenance contract) plus a **narrow Priority B/C** Clubs + Courts adapter/page remediation.

Rationale:

1. EC-01 already classified Clubs/Courts as MIXED with mock fallback notes.
2. EC-02 presentation primitives exist but sync `withFallback` still hid provenance.
3. News already has NEWS-04 honesty — do not rebuild a second news contract.
4. Tournaments / Rankings / Home have wider consumers or VPR coupling — deferred.
5. Competition `/tournament/:id/public` remains COMPETITION_E2E_OWNED.

## Exact file scope

- `src/features/public-portal/services/publicClubsCourtsDataSource.js`
- `src/features/experience-channels/public-portal/data-source/**`
- `src/components/public/states/PublicDataSourceNotice.jsx`
- `docs/experience-channels/ec-03/**`
- `tests/experience-channels-ec-03-public-portal-data-source-honesty.test.js`
- `tests/ui/public-data-source-notice.ui.test.jsx`

### Modified

- `src/features/public-portal/services/publicPortalService.js` (re-export Clubs/Courts adapters)
- `src/pages/public/ClubsPage.jsx`
- `src/pages/public/CourtsPage.jsx`
- `src/components/public/states/index.js`
- `src/features/experience-channels/public-portal/index.js`
- `src/features/experience-channels/index.js`
- `src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js`
- `src/features/experience-channels/ARCHITECTURE.md`
- `tests/experience-channels-ec-02-public-portal-presentation.test.js` (clubs error readiness)
- `scripts/ci/unit-test-files.json`

## Silent fallback findings (audit)

| Pattern | Location | EC-03 action |
|---------|----------|--------------|
| `withFallback(live, mock)` returns mock without metadata | `publicPortalService.js` Clubs/Courts | Replaced by `resolvePublicListDataResult` → MIXED |
| Rankings catch → mock | `getPublicRankings` | Deferred |
| Tournaments `withFallback` | `getPublicTournaments` | Deferred |
| Live scores / sponsors pure mock | service getters | Deferred (MOCK) |
| News silent fallback | already removed (NEWS-04) | Reuse only |

## Mock / fallback policy

- Mock fallback for Clubs/Courts **kept** until live replacement is certified.
- When used: `source=MIXED`, `fallbackUsed=true`, `fallbackReason` set, error metadata retained when load failed.
- UI shows `PublicDataSourceNotice` — never presented as LIVE.

## Competition collision

- No edits under `src/features/competition-engine/**`
- `/tournament/:id/public` untouched
- Boundary markers remain `safeForRemediation: false`

## Non-goals confirmation

- No SQL / Supabase / RLS
- No Notification backend
- No Competition Engine behavior
- No Platform Core provider/router/PWA edits
- No package/lockfile changes
