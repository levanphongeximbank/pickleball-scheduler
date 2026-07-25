# EC-04 — Public Portal List-Surface Data Honesty

**Workstream:** Experience Channels EC-04  
**Branch:** `feature/experience-channels-04-public-portal-list-surface-data-honesty`

## Goal

Harden data-source honesty for Public Portal list surfaces `/tournaments` and `/rankings`. Reuse EC-03 `PublicDataResult` / provenance contract and EC-02 presentation states. Keep mock fallback with explicit MOCK/MIXED provenance.

## Slice delivered

1. `getPublicTournamentsResult` / `getPublicRankingsResult` public-only adapters
2. Tournaments + Rankings page wiring (`PublicDataSourceNotice`, error/empty/unavailable, caller-controlled retry)
3. Registry notes updated for those surfaces
4. Mock fallback **retained** (not removed); silent catch on rankings removed

## Explicit non-goals

- No Home / News / Clubs / Courts changes in this slice
- No Competition Engine / `/tournament/:id/public` edits
- No ranking/rating/standings/eligibility calculation changes
- No router / shell / provider / PWA edits
- No SQL / Supabase / Notification backend
- No full Public Portal LIVE cutover

See `00_EC_04_LIST_SURFACE_DATA_HONESTY_REPORT.md` for full evidence.
