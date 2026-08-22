# 01 — Public Route Inventory

**Scope:** PUBLIC / PRE-LOGIN only. Authenticated routes listed only when they collide or are mislinked from public chrome.  
**Source of truth:** `src/router.jsx`  
**Audit date:** 2026-08-22  

---

## Boundary model

| Band | Mechanism | Effect |
|------|-----------|--------|
| Standalone | No layout shell | `/login`, password flows, `/referee/:token`, `/403` |
| `PublicTournamentExperienceLayout` | Club/Tenant providers; **no** PublicHeader | `/tournament/:id/public` |
| `PublicLayout` | `PublicHeader` + `PublicFooter` | Marketing/catalog portal |
| `MainLayout` + `RouteAccessGate` | Auth when production auth/RBAC on | Application after login |

`isPublicAuthPath` (`src/auth/authGuard.js`) lists `/login`, password paths, `/home`, `/clubs`, `/courts`, `/rankings`, `/news`, `/referee/:token`. It does **not** list `/`, `/public/*`, or `/tournament/*/public` — those remain public because they sit **outside** `MainLayout`.

---

## Inventory table

| Route | Page | Access | Source | Shell | Data Source | Data Classification | Responsive | SEO | Canonical Status | Notes |
|-------|------|--------|--------|-------|-------------|---------------------|------------|-----|------------------|-------|
| `/` | Public root → Home (or redirect authed → `/dashboard`) | Public / session-aware | `PublicRootPage.jsx` | PublicLayout | Same as Home | Mixed (see Home) | NOT_TESTED | FAIL | Canonical | Near-dup of `/home` |
| `/home` | Homepage | Public | `HomePage.jsx` | PublicLayout | Home + news + clubs/courts/tournaments services | SAFE_EXPLICIT_FALLBACK + conditional REAL | NOT_TESTED | PARTIAL (title only) | Canonical | Hero, stats, hub, ecosystem |
| `/public/tournaments` | Tournament discovery | Public | `TournamentsPage.jsx` | PublicLayout | `loadPublicTournamentsPageResult` (default REMOTE) | REAL_DATA or EMPTY (local forbid mock) | NOT_TESTED | PARTIAL | Canonical | Cards mislink detail |
| `/clubs` | Club discovery | Public | `ClubsPage.jsx` | PublicLayout | `loadPublicClubsPageResult` (mock allowed) | SAFE_EXPLICIT_FALLBACK / REAL | NOT_TESTED | PARTIAL | Canonical | Cards → `/clubs` only |
| `/clubs/:publicId` | Club detail stub | Public | `PublicCatalogNotFoundPage` | PublicLayout | None | EMPTY_STATE | NOT_TESTED | PARTIAL | Placeholder | Honest 404 |
| `/courts` | Court/facility discovery | Public | `CourtsPage.jsx` | PublicLayout | `loadPublicCourtsPageResult` | SAFE / REAL / partial UNSAFE amenities | NOT_TESTED | PARTIAL | Canonical-needs-converge | Facility semantics |
| `/courts/:publicId` | Court detail stub | Public | `PublicCatalogNotFoundPage` | PublicLayout | None | EMPTY_STATE | NOT_TESTED | PARTIAL | Placeholder | Honest 404 |
| `/rankings` | Public VPR rankings | Public | `RankingsPage.jsx` | PublicLayout | `loadPublicRankingsPageResult` | SAFE / REAL / MOCK when VPR off | NOT_TESTED | PARTIAL | Canonical | No player deep-link |
| `/news` | News listing | Public | `NewsPage.jsx` | PublicLayout | `getPublicNews` (default live) | REAL_DATA or labeled MOCK | NOT_TESTED | PARTIAL | Canonical | No article route |
| `/tournament/:tournamentId/public` | Canonical Public Tournament Page (#23) | Public | `IndividualPublicExperiencePage.jsx` | PublicTournamentExperienceLayout | `useCanonicalTournament(activeClub,…)` | REAL_DATA if club scope OK else EMPTY | NOT_TESTED | FAIL | Canonical | Club-scoped read risk |
| `/login` | Login (+ signup mode) | Public | `LoginPage.jsx` | None | Auth services | N/A | NOT_TESTED | FAIL | Canonical auth entry | No `/register` |
| `/forgot-password` | Forgot password | Public | `ForgotPasswordPage.jsx` | None | Auth | N/A | NOT_TESTED | FAIL | Canonical | |
| `/reset-password` | Reset password | Public | `ResetPasswordPage.jsx` | None | Auth | N/A | NOT_TESTED | FAIL | Canonical | |
| `/referee/:token` | Token referee scoreboard | Public (token) | `RefereeScoreboard` | None | Referee RPC | REAL_DATA (token) | NOT_TESTED | FAIL | Canonical specialty | Out of marketing portal |

**PUBLIC_ROUTE_COUNT (patterns) = 14**

---

## Miswired / colliding routes (not public, but linked from public)

| Route | Access | Why it matters |
|-------|--------|----------------|
| `/tournaments` | Authenticated My Tournaments hub | PublicHeader “Giải đấu”; Footer “Ban tổ chức giải”; Ecosystem `path` |
| `/tournaments/:id` | Authenticated TournamentDashboard | `TournamentCard` “Xem chi tiết” |
| `/athletes`, `/athletes/:playerId` | Authenticated “Public Player Directory” | Name says Public; gated by MainLayout |
| `/dashboard/rankings` | Authenticated | Separate from `/rankings` |

---

## Classification of tournament-related paths

| Path | Class |
|------|-------|
| `/public/tournaments` | **CANONICAL** discovery |
| `/tournament/:tournamentId/public` | **CANONICAL** public tournament page |
| `/tournaments` | **LEGACY/AUTH** hub (not guest discovery) |
| `/tournaments/:id` | **DUPLICATE** competing detail vs #23 when linked from public cards |
| `IndividualTournamentPublicPage.jsx` | **LEGACY** unmounted |
| Ecosystem `/tournaments?type=vpt` | **ALIAS** into auth hub |

---

## Redirects / aliases touching public

| From | To | Notes |
|------|----|-------|
| `/` when authenticated | `/dashboard` | `PublicRootPage` |
| `/onboarding/pick-vn-rating` | `/player/skill-assessment` | Auth |
| `/clubs/discover` | `/discover-clubs` | Auth discover — not public `/clubs` |

---

## Missing public routes (gaps)

| Expected capability | Status |
|---------------------|--------|
| `/register` | MISSING (mode on `/login`) |
| `/search` | MISSING |
| `/news/:slug` or article detail | MISSING |
| `/players/:id` guest profile | MISSING |
| Real `/clubs/:id` detail | MISSING (404 stub only) |
| Real `/courts/:id` cluster detail | MISSING (404 stub only) |
| Physical courts as children of cluster | MISSING on public UX |

---

## Public shell inventory

| Piece | File | Count / notes |
|-------|------|---------------|
| Public header | `PublicHeader.jsx` | 1 canonical |
| Public footer | `PublicFooter.jsx` | 1 canonical |
| Public mobile nav | Drawer in `PublicHeader` | No bottom nav on public |
| Tournament public mini-header | Inline in `IndividualPublicExperiencePage` | Separate from PublicHeader |
| Page-local headers | None beyond tournament #23 | |

Expected nav labels present: Trang chủ, Giải đấu, CLB, Sân, BXH, Tin tức, Đăng nhập, Đăng ký miễn phí — but **Giải đấu path is wrong** for guests.
