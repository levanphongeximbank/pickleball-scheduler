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

---

## EC-03 — Public Portal Data-Source Honesty

**Module home:** `src/features/experience-channels/public-portal/data-source/`  
**Runtime adapters (public-only):** `getPublicClubsResult` / `getPublicCourtsResult` in `publicPortalService.js`  
**Presentation:** `PublicDataSourceNotice` + EC-02 state primitives on Clubs / Courts pages

**Status:** Canonical PublicDataResult contract + Clubs/Courts honesty remediation. Mock fallback **retained** with MIXED provenance. Tournaments / Rankings / Home deferred. No router / shell / provider / Competition edits.

### What EC-03 owns

- `PUBLIC_DATA_RESULT_STATUS` + result factories / `certifyPublicDataResult` / `resolvePublicListDataResult`
- Reuse of EC-01 `PUBLIC_PORTAL_DATA_SOURCE` (no second source enum)
- Honest Clubs/Courts service adapters (fallback kept, never labeled LIVE)
- `PublicDataSourceNotice` for MOCK / PREVIEW / MIXED / UNKNOWN
- EC-03 docs + certification tests

### Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Mock removal / LIVE cutover without certified replacement | Deferred |
| Tournaments / Rankings / Home honesty wiring | Deferred (next EC slice) |
| Competition `/tournament/:id/public` | COMPETITION_E2E_OWNED |
| Router / PublicLayout / providers / PWA | GLOBAL_SHARED_HIGH_COLLISION |
| Backend / SQL / Supabase / Notification | Out of scope |

### Layering (EC-03)

```
public-portal/data-source/   Pure result contract + list resolver
publicPortalService.js       Clubs/Courts Result adapters only
components/public/states/    PublicDataSourceNotice (reuse EC-02 states)
pages/public/Clubs|Courts    Consumers
docs/experience-channels/ec-03/
```

---

## EC-04 — Public Portal List-Surface Data Honesty

**Runtime adapters (public-only):** `getPublicTournamentsResult` / `getPublicRankingsResult` in `publicTournamentsRankingsDataSource.js`  
**Presentation:** reuse EC-03 `PublicDataSourceNotice` + EC-02 state primitives on Tournaments / Rankings pages

**Status:** Tournaments + Rankings honesty remediation on the EC-03 `PublicDataResult` contract. Mock fallback **retained** with MOCK/MIXED provenance. Home deferred to EC-05. No router / shell / provider / Competition / Ranking calculation edits.

### What EC-04 owns

- Honest Tournaments/Rankings list adapters (fallback kept, never labeled LIVE when fallback used)
- Page wiring for `/tournaments` and `/rankings` (notice + error/empty/unavailable + caller-controlled retry)
- Registry notes for those two surfaces
- EC-04 docs + certification tests

### Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Home honesty wiring | EC-05 |
| Mock removal / LIVE cutover without certified replacement | Deferred |
| Competition `/tournament/:id/public` | COMPETITION_E2E_OWNED / TOURNAMENT_OPS_DEFERRED |
| Ranking / rating / standings / eligibility calculation | Business Module / VPR engines (untouched) |
| Router / PublicLayout / providers / PWA | GLOBAL_SHARED_HIGH_COLLISION |
| Backend / SQL / Supabase / Notification | Out of scope |

### Layering (EC-04)

```
publicTournamentsRankingsDataSource.js   Tournaments/Rankings Result adapters
publicPortalService.js                   Re-exports for compatibility
pages/public/Tournaments|Rankings        Consumers
docs/experience-channels/ec-04/
```

---

## EC-05 — Public Portal Home Data-Source Honesty

**Runtime adapter (public-only):** `publicHomeDataSource.js`  
**Presentation:** reuse EC-03 `PublicDataSourceNotice` + EC-02 state primitives on `/home`  
**Consumes:** EC-03 Clubs/Courts + EC-04 Tournaments Result adapters; NEWS-04 typed news result

**Status:** Home section provenance + honest mock labeling. Mock fallback **retained**. No LIVE cutover. No router / shell / provider / Competition edits.

### What EC-05 owns

- Home orchestration adapter projecting per-section `PublicDataResult` (+ `sectionId`)
- Home page wiring (notice + loading/error/empty/unavailable + caller-controlled retry)
- Honest LiveDataHub titles (no false LIVE / HÔM NAY / MỚI NHẤT)
- Registry notes for `PUBLIC_HOME`
- EC-05 docs + certification tests

### Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Mock removal / LIVE cutover without certified replacement | Deferred |
| Competition `/tournament/:id/public` | COMPETITION_E2E_OWNED |
| Ranking / standings / scoring calculation | Business Module / Competition (untouched) |
| Router / PublicLayout / providers / PWA | GLOBAL_SHARED_HIGH_COLLISION |
| Backend / SQL / Supabase / Notification | Out of scope |
| Second PublicDataResult or News contract | Forbidden — reuse EC-03 / NEWS-04 |

### Layering (EC-05)

```
publicHomeDataSource.js              Home section Result projections
publicPortalService.js               Additive re-exports
pages/public/HomePage.jsx            Consumer
components/public/sections/LiveDataHubSection.jsx
docs/experience-channels/ec-05/
```

---

## EC-06 — Public Portal Certified LIVE Cutover

**Certification inventory:** `public-portal/certification/liveCutoverCertificationMatrix.js`  
**Validator:** `certifyPublicPortalLiveCutover`  
**Runtime policy:** Only `CERTIFIED_LIVE_CUTOVER` rows may remove mock fallback. Current certified count: **0**.

**Status:** Audit complete. No surface meets all twelve EC-06 gates for remote LIVE cutover without inventing APIs or touching Competition/Ranking/backend contracts. News remains ALREADY_LIVE (NEWS-04). Clubs/Courts/Tournaments retain mock fallback (NO_REMOTE_SOURCE). Rankings LIVE_SOURCE_NOT_CERTIFIED. Home mock hubs stay MOCK_WITH_HONEST_PROVENANCE.

### What EC-06 owns

- LIVE cutover classification vocabulary + frozen certification matrix
- `certifyPublicPortalLiveCutover` audit verdict (`EC_06_AUDIT_COMPLETE_NO_CERTIFIED_CUTOVER`)
- Registry notes recording EC-06 classifications
- EC-06 docs + lock tests (no forced uncertified LIVE)

### Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Inventing remote clubs/courts/tournaments/rankings APIs | Backend / future workstream |
| News production deploy / productionReady claim | NEWS production certification |
| Competition `/tournament/:id/public` | COMPETITION_E2E_OWNED |
| Ranking calculation engines | VPR / Business Module |
| Router / PublicLayout / providers / PWA / SQL | Out of scope / high-collision |

### Layering (EC-06)

```
public-portal/constants/liveCutoverClassifications.js
public-portal/certification/liveCutoverCertificationMatrix.js
public-portal/validation/certifyPublicPortalLiveCutover.js
docs/experience-channels/ec-06/
```
