# 08 — Implementation Wave Proposal

**Status:** Proposal only.  
**IMPLEMENTATION_STARTED=NO**  
**Never merge without Owner GO.**  
**Test PASS ≠ Owner visual acceptance.**

Lifecycle for every wave:

```text
AUDIT / PLAN → IMPLEMENT → PREVIEW → OWNER SCREENSHOT REVIEW → FIX → TEST → OWNER GO → MERGE
```

---

## Recommended wave structure (evidence-adjusted)

Owner hypothesis was broadly sound. Repository evidence supports **pulling navigation + tournament link integrity into Wave 1** before homepage polish, because miswired CTAs poison every discovery surface.

| Wave | Title | Change vs Owner hypothesis |
|------|-------|----------------------------|
| 1 | Public Shell + Nav Integrity | Expanded: include tournament CTA rewiring |
| 2 | Homepage | Same |
| 3 | Tournament Discovery + Public Read Integration | Expanded: link to #23 + club-agnostic read |
| 4 | Club Discovery + Detail | Same (+ real detail) |
| 5 | Court Cluster Discovery + Detail | Same + semantics lock |
| 6 | Rankings + Public Player Profiles | Same |
| 7 | News + SEO/Social foundation | Merged content + SEO start |
| 8 | Login / Registration visual convergence | Same |
| 9 | Responsive / Mobile Owner pass | Same (rendered matrix) |
| 10 | Final Production Public Audit | Same |

```text
RECOMMENDED_WAVE_COUNT=10
```

---

## Wave 1 — Public Shell + Navigation Integrity

| Field | Content |
|-------|---------|
| Objective | Guests never leave public portal via primary nav/cards by accident |
| Scope | `PublicHeader`, `PublicFooter`, mobile drawer, `TournamentCard` / ecosystem links |
| Routes | All PublicLayout routes; stop linking guests to `/tournaments` |
| Components | Header, Footer, TournamentCard, EcosystemCard |
| Dependencies | None on auth backend |
| Runtime/data | None |
| Key risks | Authenticated users still need hub access from elsewhere |
| Owner preview | Screenshot header desktop+mobile; click Giải đấu |
| Entry | Owner GO on Master Audit |
| Exit | Guest Giải đấu → `/public/tournaments`; card → `/tournament/:id/public`; Owner GO |
| PR boundary | Public chrome + link fixes only; **no** #23 redesign; **no** PR #463 |

---

## Wave 2 — Homepage

| Field | Content |
|-------|---------|
| Objective | Converge homepage truth, CTAs, and section purpose |
| Scope | `HomePage` sections; stats/hub honesty; conversion |
| Routes | `/`, `/home` |
| Dependencies | Wave 1 links |
| Risks | Over-scoping redesign |
| Exit | Owner screenshot GO; no UNSAFE stats presentation |
| PR boundary | Homepage + shared sections only |

---

## Wave 3 — Tournament Discovery + Public Page Integration

| Field | Content |
|-------|---------|
| Objective | Discovery → canonical `#23`; public read without wrong club scope |
| Scope | `TournamentsPage`, public tournament read adapter; **reuse** `IndividualPublicExperiencePage` |
| Routes | `/public/tournaments`, `/tournament/:id/public` |
| Dependencies | Canonical tournament read/public projection; Wave 1 links |
| Risks | Creating a second detail page — **forbidden**; authz leakage |
| Exit | Guest deep-link works with real public data path; Owner GO |
| PR boundary | Portal + read adapter only; no 23-screen redesign |

---

## Wave 4 — Club Discovery + Detail

| Field | Content |
|-------|---------|
| Objective | Real club list + public club profile |
| Scope | `ClubsPage`, replace not-found stub, `ClubCard` deep links |
| Routes | `/clubs`, `/clubs/:publicId` |
| Dependencies | Public catalog club DTO / RPC |
| Risks | Exposing private membership fields |
| Exit | Detail REAL or honest EMPTY; Owner GO |
| PR boundary | Clubs public only |

---

## Wave 5 — Court Cluster Discovery + Detail

| Field | Content |
|-------|---------|
| Objective | Public UX = CỤM SÂN / cơ sở; physical courts as children |
| Scope | `CourtsPage`, detail page, remove invented LIVE amenities, wire cluster domain carefully |
| Routes | `/courts`, `/courts/:publicId` |
| Dependencies | `court-cluster` / catalog read models |
| Risks | Colliding with physical court DTOs; booking scope misunderstanding |
| Exit | Owner confirms semantics; no UNSAFE amenities |
| PR boundary | Courts public only |

---

## Wave 6 — Rankings + Public Player Profiles

| Field | Content |
|-------|---------|
| Objective | Rankings converge + guest-safe player profile |
| Scope | `RankingsPage`, new public player routes (or carefully public subset) |
| Routes | `/rankings`, proposed `/players/:id` (public) |
| Dependencies | VPR / rating canonical authorities — **no new authority** |
| Risks | PII leakage; collision with `/athletes` auth directory |
| Exit | Public/private field matrix signed; Owner GO |
| PR boundary | Rankings + public profile only |

---

## Wave 7 — News / Content / SEO / Social foundation

| Field | Content |
|-------|---------|
| Objective | Article detail + head metadata foundation; robots/sitemap plan |
| Scope | News list/detail; metadata emitter; OG defaults |
| Routes | `/news`, `/news/:slug` |
| Dependencies | `news-public-content` contracts |
| Risks | SPA structural SEO still needs prerender decision |
| Exit | Article pages + basic OG; Owner GO |
| PR boundary | News + SEO layer (no full SSR unless Owner GO) |

---

## Wave 8 — Login / Registration visual convergence

| Field | Content |
|-------|---------|
| Objective | Brand/visual alignment with public shell; keep auth authority |
| Scope | `LoginPage` signup/signin presentation; optional `/register` alias |
| Routes | `/login`, password pages |
| Dependencies | Identity services unchanged |
| Risks | Accidental auth behavior change |
| Exit | Visual GO only; auth regression tests PASS |
| PR boundary | Auth pages UI only |

---

## Wave 9 — Responsive / Mobile

| Field | Content |
|-------|---------|
| Objective | Rendered matrix PASS/PARTIAL at 7 widths |
| Scope | All public surfaces |
| Dependencies | Waves 1–8 content stable |
| Exit | Filled `05-RESPONSIVE-MATRIX` with evidence screenshots; Owner GO |
| PR boundary | CSS/layout fixes only |

---

## Wave 10 — Final Production Public Audit

| Field | Content |
|-------|---------|
| Objective | Re-audit production readiness; UNSAFE=0; funnel correct; SEO baseline |
| Scope | Docs + go/no-go |
| Exit | Production public checklist Owner GO |
| PR boundary | Docs / checklist; no feature creep |

---

## Explicit non-goals (all waves)

```text
TOUCH_PR_463=NO
MODIFY_AUTHENTICATED_APP_SHELL=NO
REDESIGN_TOURNAMENT_23_SCREENS=NO
CREATE_DUPLICATE_TOURNAMENT_DETAIL=NO
CREATE_NEW_RATING_OR_RANKING_AUTHORITY=NO
SILENT_MOCK_AS_LIVE=NO
```
