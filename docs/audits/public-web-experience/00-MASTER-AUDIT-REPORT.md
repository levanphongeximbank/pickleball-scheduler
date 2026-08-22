# 00 — Canonical Public Website Master Audit Report

**Workstream:** PICK_VN — PUBLIC WEB EXPERIENCE  
**Phase:** PHASE 0 — MASTER AUDIT ONLY  
**Date:** 2026-08-22  
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\public-web-experience-01`  
**Branch:** `feat/public-web-experience-01`  
**AUDIT_HEAD / ORIGIN_MAIN:** `0fefcb7ddb7f3d637d6fabe51c5b1b670c96978c`  
**WORKTREE_CLEAN at start:** YES  

```text
APPLICATION_IMPLEMENTATION_STARTED=NO
SQL_CREATED=NO
SQL_EXECUTED=NO
STAGING_MUTATED=NO
PRODUCTION_MUTATED=NO
PR_463_TOUCHED=NO
TOURNAMENT_23_SCREEN_RUNTIME_REDESIGNED=NO
```

---

## Final verdict

```text
FINAL_VERDICT=PUBLIC_PORTAL_EXISTS_BUT_NOT_PRODUCTION_READY
```

A dark navy / lime **PublicLayout** portal already exists (`/`, `/home`, `/public/tournaments`, `/clubs`, `/courts`, `/rankings`, `/news`) with honesty labels for mock/fallback. The frozen Tournament Experience **screen #23** exists at `/tournament/:tournamentId/public`.

Production closure is **blocked** by: (1) discovery → wrong tournament detail (auth organizer hub), (2) court semantics / missing cluster detail, (3) public tournament page still club-scoped via `activeClub`, (4) SEO/social structural SPA gaps, (5) missing club/player/news-detail/search public experiences.

---

## Worktree gate

| Check | Expected | Actual |
|-------|----------|--------|
| Branch | `feat/public-web-experience-01` | PASS |
| HEAD | `0fefcb7…` | PASS |
| `origin/main` | `0fefcb7…` | PASS |
| Clean | YES | PASS |
| FAIL_CLOSED | — | NO |

---

## What exists (Owner plain language)

PICK_VN already has a **pre-login website shell**: header, footer, mobile drawer, and marketing pages for home, tournaments list, clubs list, courts list, rankings, and news. Guests can also open a **public tournament page** (Experience #23) if they know the URL — but the browse list does **not** send them there.

Login exists; registration is a **mode on the same login page**, not a separate `/register` route.

---

## Critical findings (evidence-backed)

### P0

1. **Tournament discovery links to authenticated organizer detail, not canonical public page**  
   - Evidence: `TournamentCard.jsx` → `/tournaments/${id}` (under `MainLayout` + `RouteAccessGate`).  
   - Canonical public: `/tournament/:tournamentId/public` (`IndividualPublicExperiencePage`).  
   - Guest “Xem chi tiết” → login wall / wrong product surface.  
   - Header “Giải đấu” → `/tournaments` (My Tournaments hub), not `/public/tournaments`.

2. **Live courts mapper invents amenities on otherwise LIVE cards**  
   - Evidence: `mapLiveCourts()` in `publicClubsCourtsDataSource.js` hardcodes `amenities: ["Đèn LED", "Sân chuẩn"]`.  
   - Classification: **UNSAFE_LOOKS_REAL** for amenity fields on LIVE path.

### P1

3. **Canonical public tournament page is club-scoped, not catalog-public**  
   - Evidence: `IndividualPublicExperiencePage` → `useClub().activeClub` → `useCanonicalTournament(activeClub, id)` → requires `clubId` (`useCanonicalTournament.js`).  
   - Anonymous deep-link without correct club scope fails closed (“Không tìm thấy…”).  
   - Not a competing *UI* rewrite of 23 screens — but **runtime integration risk**.

4. **Court domain collision: facility cards vs physical courts vs cụm sân**  
   - Public `/courts` cards show facility-like aggregates (`courtCount`, address, price) — mock & club-as-venue live map.  
   - Catalog DTO path (`mapCatalogCourtDtoToPortalCard`) models **physical** court fields.  
   - True **cụm sân** domain (`src/features/court-cluster/`) is **not wired** to public portal.  
   - Detail routes `/courts/:publicId` are honest 404 stubs only.

5. **No real public Club Detail / Court Cluster Detail / Player Profile / News Article / Search**  
   - `/clubs/:publicId`, `/courts/:publicId` → `PublicCatalogNotFoundPage`.  
   - Cards loop to list (`ClubCard` → `/clubs`, `CourtCard` → `/courts`).  
   - `/athletes` is authenticated directory, not guest public.  
   - No `/news/:slug`, no `/search`, no `/register`.

6. **SEO / social structurally incomplete for SPA**  
   - Static `index.html` title/description only + `usePublicDocumentTitle`.  
   - No Helmet/OG/Twitter/canonical/robots/sitemap/structured data/share images.  
   - Brand conflict: HTML “Pickleball Scheduler Pro” vs chrome “PICK_VN”.

### P2

7. Dual visual systems: public navy/lime (`publicPortalStyles.js`) vs app emerald Slate + login shell.  
8. Auth pages outside PublicLayout.  
9. Footer placeholder links (pricing/contact → `/login`; legal → `/news`).  
10. Mid-width nav: hamburger until `lg` while desktop CTA appears earlier (`PublicHeader.jsx`).  
11. Unused legacy `IndividualTournamentPublicPage.jsx` (not mounted).  
12. Ecosystem marketing cards link to authenticated `/tournaments?type=…`.

### P3

13. Social chips FB/YT/TT/IG are non-functional labels.  
14. Newsletter UI in footer (no proven backend in audit).  
15. Duplicate near-routes `/` and `/home`.

---

## Counts (machine summary)

| Metric | Value |
|--------|-------|
| PUBLIC_ROUTE_COUNT (patterns) | 14 |
| PUBLIC_CANONICAL_ROUTE_COUNT | 10 |
| PUBLIC_DUPLICATE_OR_MISWIRED | 3+ |
| PUBLIC_MISSING_ROUTE_COUNT | 6+ |
| REAL_DATA_SURFACE_COUNT | 3–5 (conditional) |
| SAFE_EXPLICIT_FALLBACK_COUNT | 8+ |
| UNSAFE_LOOKS_REAL_COUNT | 1 confirmed field-path (+ risk if notices fail) |
| EMPTY_STATE_COUNT | 4+ |
| COURT_CLUSTER_SEMANTICS | PARTIAL_FACILITY_CARDS_NOT_CỤM_SÂN |
| PHYSICAL_COURT_SEMANTICS | CATALOG_DTO_ONLY_NOT_UX |
| COURT_DOMAIN_COLLISION_FOUND | YES |
| PUBLIC_TOURNAMENT_CANONICAL_ROUTE | `/tournament/:tournamentId/public` |
| DUPLICATE_TOURNAMENT_DETAIL_FOUND | YES (`/tournaments/:id` miswired from cards) |
| SEO_STATUS | FAIL (structural SPA + missing meta) |
| SOCIAL_SHARING_STATUS | FAIL |
| PUBLIC_PRIVATE_BOUNDARY_STATUS | PARTIAL (layouts OK; nav CTAs leak to auth) |
| P0 / P1 / P2 / P3 | 2 / 4 / 6 / 3 |
| RECOMMENDED_WAVE_COUNT | 10 (reordered) |

**Responsive:** all viewports **NOT_TESTED** (no `node_modules`; audit forbids install). Code patterns suggest intentional MUI breakpoints — insufficient for PASS.

---

## Reuse / converge / rebuild / remove

| Target | Decision |
|--------|----------|
| PublicLayout + Header/Footer | **CONVERGE** (fix nav targets + CTA consistency) |
| Homepage | **CONVERGE** (data honesty already strong; fix links + section truth) |
| `/public/tournaments` | **CONVERGE** (wire cards → canonical public page) |
| `/tournament/:id/public` (#23) | **REUSE** UI; **CONVERGE** data read path (club-agnostic public read) |
| Clubs list | **CONVERGE** |
| Club detail | **NEW_ROUTE_REQUIRED** (currently 404 stub) |
| Courts list | **CONVERGE** semantics → CỤM SÂN / cơ sở |
| Court cluster detail | **NEW_ROUTE_REQUIRED** |
| Rankings | **CONVERGE** |
| Public player profile | **NEW** guest surface or CONVERGE from `/athletes` with public boundary |
| News list | **CONVERGE**; article detail **NEW** |
| Search | **NEW** or deferred |
| Login/register visual | **CONVERGE** toward public brand (no auth authority change) |
| Legacy `IndividualTournamentPublicPage.jsx` | **REMOVE_OR_REDIRECT** (unmounted) |
| Header link `/tournaments` | **REMOVE_OR_REDIRECT** → `/public/tournaments` for guests |

---

## Recommended next wave

**PUBLIC WAVE 1 — Public Shell + Navigation Integrity**  
Fix header/footer/mobile targets so guests stay on public routes; point “Giải đấu” to `/public/tournaments`; stop sending discovery CTAs into authenticated hubs. No redesign of Tournament 23 screens. Owner screenshot review required before merge.

---

## Audit document index

1. `01-PUBLIC-ROUTE-INVENTORY.md`  
2. `02-PUBLIC-SITEMAP-AND-ARCHITECTURE.md`  
3. `03-DESIGN-SYSTEM-AUDIT.md`  
4. `04-MOCK-FALLBACK-DATA-MATRIX.md`  
5. `05-RESPONSIVE-MATRIX.md`  
6. `06-SEO-SOCIAL-SHARING-AUDIT.md`  
7. `07-PUBLIC-PAGE-GAP-MATRIX.md`  
8. `08-IMPLEMENTATION-WAVE-PROPOSAL.md`  

---

## Owner decisions required

1. Confirm discovery cards must open `/tournament/:id/public` (not organizer hub).  
2. Confirm public `/courts` means **CỤM SÂN / cơ sở**, not physical court-per-card.  
3. Confirm whether guest public player profiles are in scope for GA public web.  
4. Confirm Wave order (proposed reordering: Shell → Tournament link fix → Courts semantics → …).  
5. Explicit **Owner GO** before any implementation wave starts.

```text
MASTER_AUDIT_COMPLETE=YES
IMPLEMENTATION_STARTED=NO
WAITING_FOR_OWNER_REVIEW=YES
```
