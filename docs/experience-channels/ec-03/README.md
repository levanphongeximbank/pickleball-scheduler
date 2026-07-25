# EC-03 — Public Portal Data-Source Honesty

**Workstream:** Experience Channels EC-03  
**Branch:** `feature/experience-channels-03-public-portal-data-source-honesty`

## Goal

Make Public Portal data provenance explicit. Prevent silent success when live load fails or falls back to mock. Reuse EC-01 source enums and EC-02 presentation states.

## Slice delivered

1. Canonical `PublicDataResult` contract under `public-portal/data-source/`
2. Honest Clubs / Courts adapters (`getPublicClubsResult`, `getPublicCourtsResult`)
3. `PublicDataSourceNotice` + Clubs/Courts page wiring
4. Mock fallback **retained** with MIXED provenance (not removed)

## Explicit non-goals

- No Competition Engine / tournament public detail edits
- No router / shell / provider / PWA edits
- No SQL / Supabase / Notification backend
- No full Public Portal LIVE cutover
- No Tournaments / Rankings / Home honesty wiring in this slice

See `00_EC_03_DATA_SOURCE_HONESTY_REPORT.md` for full evidence.
