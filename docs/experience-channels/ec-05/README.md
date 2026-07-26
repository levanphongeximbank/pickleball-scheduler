# EC-05 — Public Portal Home Data-Source Honesty

**Workstream:** Experience Channels EC-05  
**Branch:** `feature/experience-channels-05-public-portal-home-data-source-honesty`

## Goal

Audit and harden data-source honesty for Public Portal Home (`/home`). Reuse EC-03 `PublicDataResult` / provenance contract, EC-02 presentation states, and EC-03/04 Clubs/Courts/Tournaments adapters. Keep mock fallback with explicit MOCK/MIXED provenance.

## Slice delivered

1. `publicHomeDataSource.js` — per-section Result projections (`sectionId` + provenance)
2. Home page wiring (`PublicDataSourceNotice`, loading/error/empty/unavailable, caller-controlled retry)
3. Honest LiveDataHub titles (no false LIVE / HÔM NAY / MỚI NHẤT)
4. Registry notes for `PUBLIC_HOME`
5. Mock fallback **retained** (not removed); silent news empty-on-error removed on Home

## Explicit non-goals

- No LIVE cutover without certified remote public source
- No Competition Engine / `/tournament/:id/public` edits
- No ranking/standings/scoring calculation in UI
- No router / shell / provider / PWA edits
- No SQL / Supabase / Notification backend
- No second PublicDataResult or News contract

See `00_EC_05_HOME_DATA_SOURCE_HONESTY_REPORT.md` for full evidence.
