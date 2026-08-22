# 02 — Public Sitemap and Architecture Proposal

**Status:** Proposal only — no implementation.  
**Principle:** REUSE_FIRST=YES. Do not invent duplicate tournament detail.

---

## Proposed canonical public sitemap

```text
/
├── home                         (or keep / as alias of home)
├── public/tournaments           REUSE_EXISTING discovery
│   └── → /tournament/:id/public REUSE_EXISTING #23 (DO_NOT_CREATE_DUPLICATE)
├── clubs                        REUSE_EXISTING list
│   └── :publicId                CONVERGE stub → real Club Public Profile
├── courts                       CONVERGE → CỤM SÂN / cơ sở discovery
│   └── :publicId                NEW/CONVERGE → Court Cluster Detail
│       └── physical courts      children inside detail (not separate top-level cards)
├── rankings                     REUSE_EXISTING
├── players                      NEW_ROUTE_REQUIRED (guest) OR deferred
│   └── :playerId                NEW_ROUTE_REQUIRED
├── news                         REUSE_EXISTING list
│   └── :slug                    NEW_ROUTE_REQUIRED
├── search                       NEW_ROUTE_REQUIRED (or Wave-deferred)
├── login                        REUSE_EXISTING
│   └── (signup mode)            CONVERGE_EXISTING (optional later /register alias)
├── forgot-password              REUSE_EXISTING
└── reset-password               REUSE_EXISTING
```

### Route decision matrix

| Target | Classification |
|--------|----------------|
| `/`, `/home` | REUSE_EXISTING; optionally ALIAS_OR_REDIRECT one to the other |
| `/public/tournaments` | REUSE_EXISTING |
| `/tournament/:id/public` | REUSE_EXISTING — **DO_NOT_CREATE_DUPLICATE** |
| `/tournaments` from guest nav | ALIAS_OR_REDIRECT guests → `/public/tournaments` |
| `/tournaments/:id` from public cards | REMOVE_OR_REDIRECT → `#23` public path |
| `/clubs` | REUSE_EXISTING |
| `/clubs/:publicId` | CONVERGE_EXISTING (replace 404 stub with profile) |
| `/courts` | CONVERGE_EXISTING (cụm sân semantics + copy) |
| `/courts/:publicId` | CONVERGE_EXISTING / NEW detail (cluster) |
| `/rankings` | REUSE_EXISTING |
| `/news` | REUSE_EXISTING |
| `/news/:slug` | NEW_ROUTE_REQUIRED |
| `/search` | NEW_ROUTE_REQUIRED |
| `/players…` public | NEW_ROUTE_REQUIRED |
| `/login` (+ signup) | CONVERGE_EXISTING visual |
| `/register` | ALIAS_OR_REDIRECT to login signup mode (optional) |

---

## Canonical public website architecture

### Layer 1 — Public Shell

```text
Public Header
Public Navigation (guest-safe targets)
Public Mobile Navigation (drawer)
Public Footer
Public Page Container (publicPortalStyles)
Public Metadata / SEO Layer (future — not present)
```

**Today:** `PublicLayout.jsx` + `PublicHeader` + `PublicFooter` + `publicPortalStyles.js`.  
**Gap:** SEO layer; nav integrity; tournament #23 uses separate mini chrome.

### Layer 2 — Discovery

```text
Homepage
Tournament Discovery (/public/tournaments)
Club Discovery (/clubs)
Court Cluster Discovery (/courts)  ← semantic target
Rankings (/rankings)
News (/news)
Search (missing)
```

### Layer 3 — Public Entity Experiences

```text
Canonical Tournament Public Page  → REUSE #23
Club Public Profile               → missing (404 stub)
Court Cluster Public Detail       → missing (404 stub)
Player Public Profile             → missing for guests
News Article                      → missing
```

### Layer 4 — Conversion

```text
Login / Registration (LoginPage modes)
Tournament participation CTAs (on #23 registration block)
Club / cluster participation CTAs (weak / absent)
```

### Layer 5 — Canonical Read Integration

```text
PUBLIC PRESENTATION (pages/components under PublicLayout)
        ↓
CANONICAL READ ADAPTER / READ MODEL
  - public-portal services
  - public-catalog DTO mappers
  - news-public-content projections
  - derivePublicExperienceModel (#23)
        ↓
CANONICAL DOMAIN AUTHORITY
  - tournament queries / catalog RPCs / news RPCs / VPR / court-cluster
```

**Separate:** AUTHENTICATED APPLICATION (`MainLayout`, PR #463 track) — do not merge shells.

---

## Integration: Tournament Discovery → Canonical Public Page

**Required funnel:**

```text
Public Tournament Discovery
        ↓
Canonical Public Tournament Page (/tournament/:id/public)
        ↓
Existing Canonical Tournament Experience (read-only public tabs)
```

**Current broken funnel:**

```text
/public/tournaments
        ↓ TournamentCard
/tournaments/:id   ← authenticated organizer dashboard
```

Registry note in `publicPortalSurfaceRegistry.js` already acknowledges deferred deep-link to `#23`.

**Do not** rebuild the 23-screen tournament runtime. Fix linkage + public read scope only.

---

## Court domain architecture (mandatory)

```text
CỤM SÂN / CƠ SỞ SÂN  (public /courts card)
 └── Sân 1 (physical)
 └── Sân 2
 └── …
```

Tournament ops (authenticated, out of scope to redesign here):

```text
select court cluster / facility
→ select one or more physical courts
→ assign matches
```

Selecting a cluster ≠ reserving all physical courts.

**Today:** public maps club venues / mock facilities; court-cluster feature unused on portal.

---

## Public / private boundary (target)

| Concern | Target |
|---------|--------|
| Guest nav | Only public routes |
| Auth CTAs | `/login` (and signup mode) |
| Organizer tools | Never linked from guest discovery cards |
| Public tournament read | Club-agnostic catalog/public projection |
| Admin / tenant private fields | Never in public DTOs |

---

## Shell convergence note

Keep **one** PublicHeader/Footer for Layers 1–2 and entity pages under PublicLayout. Tournament #23 may keep a slim public chrome **or** optionally wrap with PublicLayout later — decision deferred; do not fork a second marketing header system.
