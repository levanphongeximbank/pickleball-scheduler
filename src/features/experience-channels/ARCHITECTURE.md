# Experience Channels Architecture (EC-00)

**Module home:** `src/features/experience-channels/`

**Status:** Architecture & ownership foundation only. Contracts + frozen registries + certification. **Not wired** into `src/router.jsx`, `src/main.jsx`, App shell, or provider trees.

**Baseline:** EC-00 Channel Architecture & Ownership Foundation.

---

## Purpose / Ownership

Experience Channels owns the **presentation-channel architecture map**:

- stable channel descriptors (`channelId`, visibility, surfaces, readiness);
- route / shell / provider ownership inventories;
- collision classifications (including Competition E2E defer markers);
- Web / PWA / future iOS / Android readiness metadata;
- architecture certification helpers.

> Registry describes presentation ownership only. It does not encode ranking, rating, scoring, standings, eligibility, finance, scheduling, or competition rules.

---

## Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Global router / main entry / app shell edits | Platform / existing app (high collision — deferred) |
| Competition Engine integration | Competition E2E workstream |
| Competition Management domain contracts | `src/features/competition-management` |
| Notification delivery / queue / providers | Notification module |
| Native iOS / Android store binaries | Not started (0%) |
| SQL / RLS / Supabase | Out of scope |

---

## Layering

```
index.js         Public facade (safe re-export; no runtime wiring)
constants/       Enums and allowlists
contracts/       Descriptor factories (pure)
registry/        Frozen channel + ownership registries
validation/      Deterministic certification helpers
```

---

## EC-00 non-goals

- No new pages or route behavior changes
- No UI visual changes
- No Capacitor / React Native / Expo
- No package.json dependency additions for this foundation
- No SQL / RLS / notification backend changes

---

## EC-01 — Public Portal Channel Readiness Certification

**Module home:** `src/features/experience-channels/public-portal/`

**Status:** Readiness certification contracts + frozen surface inventory. **Not wired** into router / main / providers. **No UI remediation** in this phase.

### What EC-01 owns

- Public Portal surface descriptors (`surfaceId`, route pattern, data source, readiness dimensions)
- Boundary markers for adjacent “public-named” surfaces (`/athletes*`, `/tournament/:id/public`)
- SEO / PWA / shell shared evidence (audit metadata only)
- `certifyPublicPortalReadiness()` deterministic certification

### Explicit non-ownership (unchanged)

| Concern | Owner |
|---------|--------|
| `PublicLayout.jsx` / `router.jsx` / `main.jsx` edits | Global high-collision — deferred |
| Competition Engine / tournament public standings UI | Competition E2E / Tournament Ops |
| Per-route SEO Helmet / OG | Deferred (global entrypoint collision) |
| PWA registration / VitePWA config | Deferred (global high-collision) |
| Native iOS / Android store | 0% — metadata only |

### Layering (EC-01)

```
public-portal/
  constants/     Surface IDs + data-source enums
  contracts/     Descriptor factories (pure)
  registry/      Frozen surface + boundary inventories
  validation/    certifyPublicPortalReadiness
  index.js       EC-01 façade
```

---

## EC-02 — Public Portal Presentation Hardening

**Runtime home:** `src/components/public/states/` + `src/components/public/usePublicDocumentTitle.js`  
**Pages touched (public-only):** Clubs / Tournaments / Courts / Rankings / News (+ Home title)

**Status:** Presentation state primitives + selective page wiring. Does **not** change data sources, router, PublicLayout, providers, Competition Engine, or PWA registration.

### What EC-02 owns

- `PublicLoadingState` / `PublicErrorState` / `PublicEmptyState` / `PublicUnavailableState`
- Page-local `document.title` via `usePublicDocumentTitle`
- Empty-state + a11y/responsive polish on safe public list pages
- EC-02 docs + unit/UI tests

### Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Loading/error runtime wiring where fetch is sync + mock-backed | Deferred (needs data-source workstream) |
| Global SEO (Helmet / OG / sitemap / robots) | Deferred |
| PublicLayout / Header / Footer / router | GLOBAL_SHARED_HIGH_COLLISION |
| Competition public tournament UX | COMPETITION_E2E / DEFERRED |
| Mock → LIVE data cutover | Deferred |

### Layering (EC-02 runtime)

```
src/components/public/states/     Presentation primitives
src/components/public/usePublicDocumentTitle.js
src/pages/public/<safe pages>     Consumers only
docs/experience-channels/ec-02/   Evidence
```

EC-01 registry notes may record EC-02 presentation deltas without claiming production-ready portal or hiding MIXED/MOCK data gaps.