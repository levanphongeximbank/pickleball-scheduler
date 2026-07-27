# PWA & Portal Certification (Post-Merge)

## Routes

`/`, `/home`, `/news`, `/clubs`, `/courts`, `/tournaments`, `/rankings` → HTTP 200 on Production.

## Portal

- Clubs/Courts: remote loaders, LIVE ACCC / Sân 3–6
- Tournaments/Rankings: remote loaders, LIVE_EMPTY empty states, no mock fallback
- Home: per-section provenance honesty retained
- News: public content path intact

## PWA

- `manifest.webmanifest` HTTP 200
- `sw.js` HTTP 200
- Native store publication remains out of scope
