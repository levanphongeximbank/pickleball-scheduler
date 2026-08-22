# 01 — Public Routing Integrity

**Phase:** Wave 1 Audit / Plan  
**Date:** 2026-08-22

---

## Route definitions (Wave 1 focus)

| Route | Access | Layout | Component | Role |
|-------|--------|--------|-----------|------|
| `/` | Public (authed → `/dashboard`) | PublicLayout | `PublicRootPage` | Public home entry |
| `/home` | Public | PublicLayout | `HomePage` | Marketing home |
| `/public/tournaments` | Public | PublicLayout | `TournamentsPage` | **Canonical guest discovery** |
| `/tournaments` | **Authenticated** | MainLayout + RouteAccessGate | My Tournaments hub | Organizer hub |
| `/tournaments/:id` | **Authenticated** | MainLayout + RouteAccessGate | Tournament dashboard | Organizer detail |
| `/tournament/:tournamentId/public` | Public (route-open) | PublicTournamentExperienceLayout | `IndividualPublicExperiencePage` | **Canonical guest detail (#23)** |
| `/login` | Public | None | `LoginPage` | Auth entry (+ signup **mode**) |
| Registration | No `/register` | — | Signup mode on `LoginPage` | Conversion |

Evidence: `src/router.jsx`, `src/auth/authGuard.js` (`isMyTournamentsHubPath` never public).

---

## Anonymous user flow diagrams

### Broken flow (current)

```text
ANONYMOUS USER
→ PublicHeader "Giải đấu" (/tournaments)
→ MainLayout + RouteAccessGate
→ auth required
→ /login
→ NOT public tournament discovery
```

```text
ANONYMOUS USER
→ /public/tournaments OR Home featured TournamentCard
→ CTA /tournaments/:id
→ MainLayout + RouteAccessGate
→ /login
→ NOT /tournament/:id/public
```

```text
ANONYMOUS USER
→ knows /tournament/:id/public
→ PublicTournamentExperienceLayout (ClubProvider…)
→ IndividualPublicExperiencePage
→ clubScopeReady === false (guest idle)
→ infinite "Đang tải…"
→ data read never completes via canonical_tournament_get (anon revoked)
```

### Target flow (Wave 1)

```text
ANONYMOUS USER
→ PublicHeader "Giải đấu" (/public/tournaments)
→ TournamentsPage
→ public catalog / portal list read
→ TournamentCard
→ /tournament/:tournamentId/public
→ #23 page
→ guest-safe read (1B) OR honest empty until SQL (1A)
→ frozen #23 UI
```

Authenticated users keep:

```text
AUTHENTICATED USER
→ app shell / menu → /tournaments → organizer hub
→ /tournaments/:id → organizer dashboard
(AUTHENTICATED_ONLY_KEEP)
```

---

## Places guests accidentally enter authenticated Tournament experience

| Source | Current target | Risk |
|--------|----------------|------|
| `PublicHeader` NAV “Giải đấu” | `/tournaments` | Login wall |
| `PublicFooter` “Ban tổ chức giải” | `/tournaments` | Login wall |
| `TournamentCard` CTA | `/tournaments/${id}` | Login wall / wrong product |
| Home featured cards | via TournamentCard | Same |
| Discovery list cards | via TournamentCard | Same |
| `ECOSYSTEM_ITEMS` (unused UI) | `/tournaments?type=…` | Latent miswire |

---

## Machine output

```text
PUBLIC_ROUTE_INTEGRITY_ROOT_CAUSE=
Public chrome and TournamentCard hardcode authenticated hub/detail paths
(/tournaments, /tournaments/:id) instead of guest-safe
(/public/tournaments, /tournament/:id/public). Separately, #23 is route-public
but not guest-data-capable (activeClub + authenticated RPC).

EXACT_FILES=
- src/components/public/PublicHeader.jsx
- src/components/public/PublicFooter.jsx
- src/components/public/cards/TournamentCard.jsx
- src/pages/public/HomePage.jsx (inherits card)
- src/pages/public/TournamentsPage.jsx (inherits card)
- src/data/public/mockPublicData.js (ECOSYSTEM_ITEMS latent)
- src/features/tournament/experience-a1/pages/IndividualPublicExperiencePage.jsx
- src/context/ClubContext.jsx
- src/features/tournament/hooks/useCanonicalTournament.js
- src/features/tournament/services/tournamentQueries.js
- src/features/tournament/repositories/cloudTournamentRepository.js
- src/router.jsx (definitions; optional anon redirect only)

EXACT_COMPONENTS=
PublicHeader, PublicFooter, TournamentCard, HomePage, TournamentsPage,
IndividualPublicExperiencePage, PublicTournamentExperienceLayout, RouteAccessGate

EXACT_LINK_TARGETS=
WRONG: /tournaments ; /tournaments/:id
RIGHT_GUEST: /public/tournaments ; /tournament/:tournamentId/public
KEEP_AUTH: /tournaments ; /tournaments/:id/* under MainLayout

IMPLEMENTATION_CHANGE_SET=
Wave 1A: rewire guest nav/CTA; optional anonymous soft-redirect /tournaments→/public/tournaments
without breaking authenticated hub; fail-closed #23 hang fix; no organizer route deletion.
Wave 1B: guest-safe published read (SQL) — see 02-GUEST-SAFE-TOURNAMENT-READ-TRACE.md
```

---

## Optional redirect policy (plan only)

| Actor | `/tournaments` behavior |
|-------|-------------------------|
| Anonymous | **REDIRECT_REQUIRED** (optional product) → `/public/tournaments` |
| Authenticated | **AUTHENTICATED_ONLY_KEEP** → My Tournaments hub |

Must not blindly replace every `/tournaments` string in the repo (canonical-shell / PR #463 surfaces stay).
