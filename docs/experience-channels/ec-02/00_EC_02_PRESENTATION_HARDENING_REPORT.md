# EC-02 Presentation Hardening Report

**Workstream:** EC-02 — PUBLIC PORTAL PRESENTATION HARDENING  
**Branch:** `feature/experience-channels-02-public-portal-presentation-hardening`  
**Baseline:** fresh `origin/main` (post EC-01 merge)

## Architecture decision

Implement **public-only presentation primitives** and wire them into a **small set of public list pages**, plus page-local document titles.

Rationale:

1. EC-01 already certified that loading/error/empty were thin/MISSING.
2. Sync `publicPortalService` + mock fallback still prevents honest loading/error runtime on most pages — changing that is a data-source workstream.
3. Empty / no-results / unavailable presentation + a11y semantics are safe and testable without router/shell/Competition collision.
4. Page-local `document.title` needs no Helmet / router metadata system.

## Exact file scope

### New

- `src/components/public/states/PublicPresentationStates.jsx`
- `src/components/public/states/index.js`
- `src/components/public/usePublicDocumentTitle.js`
- `docs/experience-channels/ec-02/**`
- `tests/experience-channels-ec-02-public-portal-presentation.test.js`
- `tests/ui/public-presentation-states.ui.test.jsx`

### Modified

- `src/pages/public/ClubsPage.jsx`
- `src/pages/public/TournamentsPage.jsx`
- `src/pages/public/CourtsPage.jsx`
- `src/pages/public/RankingsPage.jsx`
- `src/pages/public/NewsPage.jsx`
- `src/pages/public/HomePage.jsx` (title only)
- `src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js` (honest notes / dimension bumps)
- `src/features/experience-channels/ARCHITECTURE.md`
- `scripts/ci/unit-test-files.json`

## Collision checks

| Area | Result |
|------|--------|
| Competition E2E-05 worktree vs public pages | No overlapping diff vs main |
| `src/features/competition-engine/**` | Untouched |
| `/tournament/:id/public` | Untouched (DEFERRED) |
| PublicLayout / Header / Footer / router / main | Untouched |
| package.json / lockfile / PWA | Untouched |

## Accessibility evidence (scoped)

- Loading: `role="status"` + `aria-busy` + text label
- Error: `role="alert"` + textual title/message (not color-only)
- Empty/Unavailable: `role="status"` + `h2` title
- Actions: real MUI `Button` with accessible name; focus-visible outline
- Decorative icons: `aria-hidden`
- Page `h1` on remediating list pages
- Filter chips: `aria-pressed` + focus-visible on tournaments/rankings
- **No WCAG whole-portal claim**

## Responsive evidence (scoped)

- State containers: `width/maxWidth: 100%`, wrap long text (`overflowWrap`)
- Action min touch target 44px
- Rankings table: horizontal scroll container (`overflowX: auto`) instead of breaking layout
- Filter stacks wrap on narrow viewports
- Manual visual confirmation recommended after Owner merge on mobile/tablet/desktop

## Data-source statement

EC-02 does **not** change LIVE/MOCK/PREVIEW/MIXED sources. News remains MOCK. List pages remain MIXED with mock fallback. Mock fallback that can hide transport errors is recorded as a remaining gap.

## Non-goals confirmation

- No SQL / Supabase / RLS
- No Notification backend
- No Competition Engine behavior
- No Platform Core provider/router edits
