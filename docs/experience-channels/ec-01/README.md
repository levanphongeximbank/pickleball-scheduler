# EC-01 — Public Portal Channel Readiness Certification

**Phase:** EC-01  
**Module:** `src/features/experience-channels/public-portal/`  
**Runtime wiring:** none  
**UI remediation:** none (certification-only slice)

## What landed

- Public Portal surface inventory (`/`, `/home`, `/tournaments`, `/clubs`, `/courts`, `/rankings`, `/news`)
- Data-source classification (LIVE / MOCK / PREVIEW / MIXED / UNKNOWN)
- Readiness dimensions (responsive, a11y, SEO, loading/error/empty, PWA, tests)
- Boundary markers for `/athletes*` (PLAYER) and `/tournament/:id/public` (TOURNAMENT_OPS deferred)
- Deterministic `certifyPublicPortalReadiness()`
- Architecture unit tests + CI registration
- Audit report under `docs/experience-channels/ec-01/`

## What did not land

- No edits to `src/router.jsx`, `src/main.jsx`, `PublicLayout.jsx`, or public pages
- No Competition Engine / tournament ops UI changes
- No SEO Helmet / OG / sitemap additions
- No PWA registration / VitePWA / manifest global edits
- No SQL / Supabase / notification backend
- No native iOS / Android claims

## Reuse of EC-00

- Channel ID `public-portal`
- Classification enums (no new collision labels)
- Visibility / readiness enums
- Ownership snapshot still authoritative for route/shell/provider map

## Evidence

- Audit on fresh `origin/main` in worktree `experience-channels-01-public-portal-readiness`
- Full report: `00_EC_01_AUDIT_AND_CERTIFICATION_REPORT.md`
