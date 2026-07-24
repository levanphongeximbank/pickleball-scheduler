# EC-02 — Public Portal Presentation Hardening

**Phase:** EC-02  
**Runtime:** `src/components/public/states/` + page-local public pages  
**Contracts:** reuses EC-00 / EC-01 (no second Experience Channels registry)

## What landed

- Shared public presentation primitives: loading / error / empty / unavailable
- Page-local `document.title` hook (`usePublicDocumentTitle`)
- Wired empty states + headings/title on Clubs, Tournaments, Courts, Rankings, News
- Home page-local title only
- Unit + Vitest accessibility/responsive assertions
- Honest readiness note updates (gaps not hidden)

## What did not land

- No router / PublicLayout / Header / Footer / provider edits
- No Competition Engine or tournament public view changes
- No data-source LIVE cutover / mock removal
- No global Helmet / OG / sitemap / robots
- No PWA / package / lockfile changes
- Loading/error runtime not fully wired (sync mock-backed service still hides failures)

## Evidence

See `00_EC_02_PRESENTATION_HARDENING_REPORT.md`.
