# EC-01 Audit & Certification Report — Public Portal Channel Readiness

**Workstream:** EC-01 — PUBLIC PORTAL CHANNEL READINESS CERTIFICATION  
**Worktree:** `experience-channels/experience-channels-01-public-portal-readiness`  
**Branch:** `feature/experience-channels-01-public-portal-readiness`  
**Baseline:** fresh `origin/main` at certification start  
**Slice:** certification contracts only (no runtime UI / router / PWA edits)

---

## A. Safety baseline (start)

| Check | Result |
|-------|--------|
| Worktree path | PASS — dedicated EC-01 worktree |
| Branch | PASS — `feature/experience-channels-01-public-portal-readiness` |
| Clean status | PASS |
| Ahead/behind vs origin/main | 0 / 0 at start |
| EC-00 canonical module present | PASS — `src/features/experience-channels/**` |
| Package | `pickleball-scheduler@5.3.36` |

---

## B. Experience Channel inventory (Public Portal)

| Surface ID | Route | Classification | Data source | Overall readiness |
|------------|-------|----------------|-------------|-------------------|
| `public-root` | `/` | CANONICAL_CHANNEL_SURFACE | MIXED | PARTIAL |
| `public-home` | `/home` | CANONICAL_CHANNEL_SURFACE | MIXED | PARTIAL |
| `public-tournaments` | `/tournaments` | CANONICAL_CHANNEL_SURFACE | MIXED | PARTIAL |
| `public-clubs` | `/clubs` | CANONICAL_CHANNEL_SURFACE | MIXED | PARTIAL |
| `public-courts` | `/courts` | CANONICAL_CHANNEL_SURFACE | MIXED | PARTIAL |
| `public-rankings` | `/rankings` | CANONICAL_CHANNEL_SURFACE | MIXED | PARTIAL |
| `public-news` | `/news` | MOCK_OR_PREVIEW | MOCK | MOCK |

### Boundary markers (not Public Portal–owned)

| Boundary ID | Route | Owner | Classification |
|-------------|-------|-------|----------------|
| `boundary-athletes-directory` | `/athletes*` | PLAYER | CANONICAL (auth MainLayout) |
| `boundary-tournament-public-view` | `/tournament/:id/public` | TOURNAMENT_OPS | DEFERRED |

### Supporting assets

| Path | Role | Classification |
|------|------|----------------|
| `src/layouts/public/PublicLayout.jsx` | Shell | CANONICAL + GLOBAL_SHARED_HIGH_COLLISION (edit target) |
| `src/components/public/**` | Header/footer/cards/sections | CANONICAL / LEGACY dormant orphans |
| `src/features/public-portal/services/publicPortalService.js` | Live-first façade | CANONICAL + MOCK fallback |
| `src/data/public/mockPublicData.js` | Fixtures | MOCK_OR_PREVIEW |
| `src/router.jsx` | Route registration | GLOBAL_SHARED_HIGH_COLLISION |
| `src/features/competition-engine/**` | Engine | COMPETITION_E2E_OWNED |

---

## C. Route / shell / provider ownership map

| Concern | Owner | Notes |
|---------|-------|-------|
| PublicLayout route group | PUBLIC_PORTAL | `/home|/tournaments|/clubs|/courts|/rankings|/news` (+ `/` root guest) |
| PublicLayout shell | PUBLIC_PORTAL | High-collision file list includes this path — EC must not edit |
| Auth screens | AUTH | `/login` etc. — entry links from public header/footer/hero |
| `/athletes*` | PLAYER | Auth-gated; ownership DUPLICATED claim in EC-00 channel notes vs ownershipRegistry |
| `/tournament*` | TOURNAMENT_OPS | Deferred for EC edits |
| Auth / theme / platform providers | GLOBAL_SHARED_HIGH_COLLISION | Consumed optionally by PublicHeader |

---

## D. Competition E2E collision check

| Check | Result |
|-------|--------|
| `pages/public/**` imports competition-engine? | No |
| `publicPortalService` recalculates standings/scoring/eligibility? | No — list/map presentation + VPR query or mock |
| `/tournament/:id/public` | Recalculates individual standings via tournament helpers; MainLayout; DEFERRED |
| Competition Engine path edits | Out of scope — COMPETITION_E2E_OWNED |
| Safe EC-01 remediation of competition UX? | No |

---

## E. Gap analysis

1. No per-route SEO (`document.title` / Helmet / OG) — only global `index.html`
2. Thin loading/error UX on public pages; Courts missing empty state
3. Heavy mock paths: news, live scores, sponsors, upcoming events
4. `/athletes` incorrectly listed in EC-00 PUBLIC_PORTAL `routeNamespace` (alignment gap; corrected via EC-01 boundary marker)
5. Almost no dedicated portal tests beyond rankings smoke
6. Orphan components: `EcosystemCard`, `LiveScorePreview`
7. PWA `start_url=/` + authenticated root redirect interaction
8. Named “public” tournament view is not anonymous Public Portal

---

## F. Architecture decision

**Implement certification-only slice** under `src/features/experience-channels/public-portal/`.

Rationale:

- Reuses EC-00 channel / classification contracts (no second Experience Channels registry)
- Collision with router/shell/PWA/Competition is avoided
- High-value ownership truth + readiness gates for later remediations
- UI remediations deferred — none met all 10 safe-remediation conditions

---

## G. Exact file scope

- `src/features/experience-channels/public-portal/**`
- `src/features/experience-channels/index.js`
- `src/features/experience-channels/ARCHITECTURE.md`
- `docs/experience-channels/ec-01/**`
- `tests/experience-channels-ec-01-public-portal-readiness.test.js`
- `scripts/ci/unit-test-files.json`

---

## H. UX / accessibility / responsive evidence (read-only)

| Dimension | State | Notes |
|-----------|-------|-------|
| Mobile nav collapse | PARTIAL | PublicHeader Drawer + `aria-label="Mở menu"` |
| Landmarks | PARTIAL | AppBar + `main` Box + footer |
| Focus / keyboard | NOT_VERIFIED | No automated a11y suite for portal |
| Heading hierarchy | PARTIAL | Section headers present; not WCAG-certified |
| Image alt | PARTIAL | Cards may omit rich alt — not verified end-to-end |
| Loading / error / empty | PARTIAL / MISSING | See surface registry |
| Reduced motion | NOT_VERIFIED | |
| Visual regression | N/A | No runtime UI change in EC-01 |

**WCAG claim:** none — insufficient evidence.

---

## I. SEO / PWA evidence (read-only)

| Item | State |
|------|-------|
| Global title/description (`index.html`) | PARTIAL |
| Per-route title/meta/OG | MISSING |
| Sitemap / robots | MISSING / NOT_VERIFIED |
| Manifest + icons | PARTIAL (global) |
| SW registration | GLOBAL_SHARED_HIGH_COLLISION — deferred |
| Native iOS/Android store | 0% metadata only |

---

## J. Non-goals confirmation

- No SQL / Supabase
- No Notification backend
- No Competition Engine behavior change
- No global router/shell/provider edits
- No package/lockfile changes
