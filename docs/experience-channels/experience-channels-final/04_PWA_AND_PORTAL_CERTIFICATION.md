# PWA & Portal Certification

## Public routes

`/`, `/home`, `/clubs`, `/courts`, `/tournaments`, `/rankings`, `/news` — routing present, HTTP 200 on Production, reload-safe SPA shell.

## Portal surfaces

- Clubs/Courts pages: remote loader when `VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote` (Production active)
- Tournaments/Rankings pages: now call `loadPublic*PageResult` (selector-ready; Production stays local until Owner env cutover)
- Loading / empty / error / retry / provenance notices present
- Home composes sections with per-section provenance; featured Clubs/Courts/Tournaments remain local-honest when not on dedicated remote loaders
- News uses NEWS-04 live facade with explicit MOCK/PREVIEW labels when applicable

## PWA

- `manifest.webmanifest` HTTP 200 on Production
- `sw.js` HTTP 200 on Production
- Local build generates `dist/sw.js` + workbox
- Icons 192/512 referenced
- Native iOS/Android store publication excluded (does not block Web closure)

Evidence: `evidence/PWA_BUILD.json`, `PUBLIC_ROUTES_SMOKE.json`
