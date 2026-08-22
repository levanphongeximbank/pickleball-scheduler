# DESIGN SYSTEM MASTER AUDIT — Wave 2 Batch 2A

**WORKSTREAM:** PICK_VN — AUTHENTICATED WEB APP EXPERIENCE  
**WAVE:** WAVE 2 — SHARED DESIGN SYSTEM  
**BATCH:** 2A — CANONICAL DESIGN SYSTEM MASTER AUDIT  
**MODE:** AUDIT_ONLY — no application code, no SQL, no Staging/Production mutation  
**OWNER_GO:** AUDIT_ONLY  
**DATE:** 2026-08-22  
**BASE_SHA:** `ed5e3a9b95492d70c84326a06552a153d494fabe` (PR #463 merge — Wave 1 closed)

---

## 0. Verdict

```
FINAL_VERDICT=WEB_APP_WAVE2_DESIGN_SYSTEM_MASTER_AUDIT_READY_FOR_OWNER_REVIEW
REUSE_BEFORE_REBUILD=YES
NEW_DESIGN_SYSTEM_CREATED=NO
IMPLEMENTATION_STARTED=NO
```

The authenticated app already has a **usable shared foundation**. Wave 2 must **adapt it**, not replace it.

| Layer | Strongest existing implementation | Action |
|-------|-----------------------------------|--------|
| Global MUI theme | `src/theme/theme.js` + `src/theme/designTokens.js` (Slate Enterprise) | **KEEP / ADAPT** |
| App chrome | Wave 1 CanonicalAppShell + `figure1Tokens.js` | **FROZEN** |
| Best module visual system | Tournament Experience tokens + `ExperiencePageHeader` / `ExperienceStatusChip` | **FROZEN** — learn, do not globalize |
| Best non-frozen page kit | `src/features/club/ui/*` (`ClubPageShell`, `ClubConfirmDialog`, `ClubEmptyState`) | **ADAPT** into authenticated shared patterns |
| Best responsive table | `src/features/mobile/components/ResponsiveDataView.jsx` | **ADAPT** |
| Public visual language | `publicPortalStyles.js` (navy + lime) | **PUBLIC_SHARED** — do not inherit |

Do **not** create: a second ThemeProvider hierarchy, a second token SSoT, a parallel Button library, a parallel Table system, or a parallel PageHeader that fights `CanonicalTopBar`.

---

## 1. Previous wave lock

| Wave | Status |
|------|--------|
| Wave 0 Security/Auth | CLOSED |
| Wave 1 Canonical App Shell + Navigation | CLOSED — PR #463 merged at `ed5e3a9b` |

Frozen chrome (do not redesign in Wave 2):

- `CanonicalAppShell`
- `CanonicalSidebar`
- `CanonicalTopBar`
- `CanonicalMobileDrawer`
- `MobileBottomNav`

Frozen breakpoints (do not change):

- Desktop `>=1200`
- Tablet `900–1199`
- Mobile `<=899`

`CanonicalTopBar` is **global chrome**. Wave 2 page headers live **below** it.

---

## 2. Wave 2 questions — answers

| Question | Answer |
|----------|--------|
| What design systems/themes already exist? | 5 active theme surfaces; 13 active token modules. See `THEME_TOKEN_INVENTORY.md`. |
| Which implementation is closest to canonical? | **Workspace:** Slate `designTokens.js` + `theme.js`. **Chrome:** Figure 1 (frozen). **Best module language:** Experience-a1 (frozen, isolated). |
| What should be reused? | MUI Button/Card/Table via `theme.js`; Club page kit; `ResponsiveDataView`; Club confirm/empty; Snackbar wrapper. |
| What should be consolidated? | Empty/loading/error families; status **visual tones**; page-header ad-hoc `Typography`; Players leaking `TournamentPageHeader`. |
| What should be deprecated? | After adoption only: dead `src/index.css`; unused `@mui/x-data-grid` if never chosen; `GlobalSearch` vs Canonical (shell already Canonical). |
| Which shared components are missing? | Auth PageHeader, StatusToneChip, ConfirmDialog (global), LoadingButton, FilterBar, TablePagination, FieldError, AppSnackbar provider, shared Skeleton. |
| Which are duplicated? | 13 families. See §22 and `SHARED_COMPONENT_INVENTORY.md`. |
| Which visual semantics are inconsistent? | Three primaries (Slate green / Figure 1 blue / Experience blue); Inter vs DM Sans; radius 8/10/12; table density. |
| Adoption contract for Waves 3–5? | Strangler: new/touched authenticated screens import Layer 1–2 only; frozen Experience/Public stay isolated; no mass 186-screen migration in Wave 2. |

---

## 3. Counts (authoritative for this batch)

```
THEME_IMPLEMENTATION_COUNT=6
ACTIVE_THEME_IMPLEMENTATION_COUNT=5
TOKEN_SYSTEM_COUNT=15
ACTIVE_TOKEN_SYSTEM_COUNT=13

CANONICAL_THEME_CANDIDATE=src/theme/theme.js (KEEP/ADAPT; nested Figure 1 shell theme is FROZEN overlay, not a second app theme)
CANONICAL_TOKEN_CANDIDATE=src/theme/designTokens.js (workspace SSoT) + src/theme/figure1Tokens.js (FROZEN shell overlay)

HARDCODED_COLOR_PATTERN_COUNT=43
HARDCODED_COLOR_DISTINCT_HEX=216
HARDCODED_COLOR_LITERALS=787
HARDCODED_SPACING_PATTERN_COUNT=359

BUTTON_IMPLEMENTATION_COUNT=11
SHARED_BUTTON_IMPLEMENTATION_COUNT=2
FEATURE_LOCAL_BUTTON_PATTERN_COUNT=9
CARD_PATTERN_COUNT=11
TABLE_IMPLEMENTATION_COUNT=12
TABLE_WRAPPER_COUNT=2
DATAGRID_USAGE_COUNT=0
FORM_CONTROL_PATTERN_COUNT=7
CUSTOM_FORM_CONTROL_COUNT=5
STATUS_VISUAL_IMPLEMENTATION_COUNT=16
PAGE_HEADER_IMPLEMENTATION_COUNT=8
DIALOG_IMPLEMENTATION_COUNT=23
CONFIRM_PATTERN_COUNT=14
ICON_LIBRARY_COUNT=1

DUPLICATE_SHARED_COMPONENT_FAMILIES=13

PUBLIC_SHARED_COMPONENT_COUNT=19
AUTHENTICATED_SHARED_COMPONENT_COUNT=37
TRULY_GLOBAL_SHARED_COMPONENT_COUNT=3

TYPOGRAPHY_SCALE_COUNT=5
PAGE_HEADER_DUPLICATION_COUNT=7
```

---

## 4. Canonical candidates (do not implement in 2A)

| Concern | Candidate | Why | Do not |
|---------|-----------|-----|--------|
| Theme | `src/theme/theme.js` | Already the single root `ThemeProvider` in `main.jsx` | Add a third ThemeProvider |
| Tokens | `src/theme/designTokens.js` | Already claimed SSoT; consumed by MUI + public partial + `shellTokens` re-export | Invent a new token package |
| Shell tokens | `figure1Tokens.js` | Production chrome; Wave 1 freeze | Restyle sidebar/topbar |
| Button | MUI `Button` via `theme.js` overrides | Universal; variants missing, not the primitive | Parallel Button library |
| Surface | MUI `Card` / `Paper` via `theme.js` | Already global radius/border/shadow | New Surface package |
| Page header | Adapt `ClubPageShell` API; learn density from frozen `ExperiencePageHeader` | Strongest **non-frozen** title+subtitle+crumb+actions | Promote Experience header or confuse with `CanonicalTopBar` |
| Table | MUI `Table` + adapt `ResponsiveDataView` | DataGrid dep unused (`DATAGRID_USAGE_COUNT=0`) | Mass-adopt DataGrid in Wave 2 |
| Status visual | New auth `StatusToneChip` **cloned from Experience tone model**, Slate colors | Tone map is the reusable idea; Experience component is frozen | Make draw-room/dark chips global |
| Confirm | Adapt `ClubConfirmDialog` | Accessible Dialog, VN labels, loading, `confirmColor` | Keep `window.confirm` as the pattern |
| Empty/Loading/Error | Unify Club + `TournamentUiState` API | Same dashed-border / `role="status"` shape | Force Public dark states onto auth |
| Toast | Adapt `InterventionFeedbackSnackbar` | Only named Snackbar wrapper | Per-page Snackbar copies |

**Owner GO required before 2B (color/font only):**

1. Keep workspace **primary green `#10B981`** (current SSoT) while shell stays Figure 1 **blue `#3B82F6`**, **or** align workspace primary toward Figure 1 blue.  
2. Keep **DM Sans workspace + Inter shell**, or unify fonts.  
3. Do **not** promote Tournament `#2563EB` or Public lime `#C5E831` to global primary without a later Owner GO. Evidence does not support it.

---

## 5. Public / authenticated / global boundary

| Bucket | Policy |
|--------|--------|
| AUTHENTICATED_SHARED | Wave 2 scope. Workspace + page primitives under Canonical shell. |
| PUBLIC_SHARED | Inventory only. Navy + lime marketing language stays on public routes. |
| TRULY_GLOBAL_SHARED | MUI theme root, `CssBaseline`, `UserAvatar` (public header reuses it). |

Do **not** force the public website to inherit authenticated-app styling.

Tournament Experience 23 screens: **audit to learn only**.

```
TOURNAMENT_23_CHANGED=NO
PUBLIC_WEB_CHANGED=NO
```

Classification of tournament visuals:

| Class | Examples |
|-------|----------|
| GLOBAL_REUSABLE | Neutrals `#0F172A` / `#64748B` / `#E2E8F0` / `#F8FAFC`; success/warning/danger hex families |
| TOURNAMENT_SHARED | `TOURNAMENT_SPACE` / `RADIUS` / `TYPE`; type banners; list/standings tables |
| TOURNAMENT_SPECIFIC | Primary blues `#2563EB` / `#3B82F6`; draw-room navy; TYPE_BANNER gradients |
| FROZEN_VISUAL | Entire `experience-a1/visual/*`; showcase neon; referee V5 CSS; animation boards |

---

## 6. Proposed layers (not implemented)

```
Layer 0 — Foundations
  designTokens.js (adapt) + theme.js (adapt)
  figure1Tokens.js FROZEN (shell)
  Breakpoints FROZEN (Wave 1)

Layer 1 — Primitives
  MUI Button / IconButton / TextField / Select / Chip / Card / Paper
  StatusToneChip (new, adapted from Experience tone model + Slate colors)
  No new component libraries

Layer 2 — Shared patterns
  AuthPageHeader (adapt ClubPageShell)
  AuthEmpty / AuthLoading / AuthError (adapt Club + TournamentUiState)
  AuthConfirmDialog (adapt ClubConfirmDialog)
  AuthResponsiveTable (adapt ResponsiveDataView)
  AuthFilterBar, AppSnackbar, FieldError

Layer 3 — Domain composition
  Court / Club / Tournament / Finance / CRM / Rating chips and cards
  FEATURE_SPECIFIC_KEEP unless a visual tone is truly generic

Layer 4 — Page implementation
  Waves 3–5 adopt Layer 2; Wave 2 only pilots a few screens in 2E
```

---

## 7. Proposed Wave 2 batches

```
PROPOSED_WAVE2_BATCH_COUNT=6
```

| Batch | Name | Intent |
|-------|------|--------|
| 2A | Master Audit | This document set |
| 2B | Foundations & Tokens | Fill semantic gaps in `designTokens` + `theme.js`; no third theme; no shell restyle |
| 2C | Shared Primitives | Theme variants (destructive/loading/focus-visible); StatusToneChip; FieldError |
| 2D | Shared Patterns | PageHeader, ConfirmDialog, Empty/Loading/Error, ResponsiveTable, FilterBar, Snackbar |
| 2E | Representative Pilot | Dashboard, Players (stop tournament header leak), AuditLog table, one Court list — **not** Experience 23, **not** Public |
| 2F | Regression / Certification | Token lock tests, a11y of primitives, Wave 1 shell lock, no visual Storybook unless Owner GO |

Do **not** mass-migrate ~186 screens inside Wave 2.

---

## 8. Representative screen sample (systemic patterns)

Sampled at architecture level for desktop 1440 / tablet 1024 / mobile 430. No redesign.

| Surface | Route / entry | Header | Data | Feedback | 1440 | 1024 | 430 |
|---------|---------------|--------|------|----------|------|------|-----|
| Dashboard | `/dashboard` | Ad-hoc `Typography` + local `StatCard` **and** `KpiCard` | Tables in analytics | `DashboardEmptyState` / Alert loading | 3–4 col | 2 col | stack |
| Court ops | `CourtManagementLayout` | Feature **Tabs** + `CourtManagementSearchBar` | Calendar tokens; lists | Alert reminders | tabs+table | tabs wrap | tabs scroll; calendar `minWidth:900` = W6-PAGE-001 |
| Customer/Player | `/players` | **`TournamentPageHeader` leak** | `PlayerCard` grid + Dialog form | `TournamentEmptyState` leak | card grid | 2 col | 1 col |
| Club | `ClubPageShell` | Title + crumbs + actions | `ClubCard` / registry table | `ClubEmptyState` / skeletons | maxWidth 1100 | pad md:3 | pad xs:2 |
| Tournament outer | `TournamentShell` / Experience frame | Frozen Experience header **or** `TournamentPageHeader` | Domain tables | `TournamentUiState` | frozen | frozen | frozen |
| Finance | `/finance/*` | Ad-hoc `Typography` | MUI Table | `FinanceLedgerStateViews` | table | horizontal scroll | scroll |
| Reports | `/reports` | Hub cards | KPI-ish | PARTIAL honesty | cards | stack | stack |
| CRM | `/crm/*` | Ad-hoc | MUI Table + HTML date/datetime | `CrmLegacyStateViews` | table | scroll | scroll |
| Admin | `/audit`, `/admin/*` | Ad-hoc `h4`/`h5` | Dense MUI Table | Alert | table | wrap | **W6-PAGE-002 nowrap ellipsis** |
| Support | `/support*` | Ad-hoc `h5` | List | Static | readable | readable | readable |

Systemic finding: **chrome is one product (Wave 1); page bodies are many products.**

---

## 9. Accessibility snapshot

| Severity | Gaps |
|----------|------|
| CRITICAL | No global `focus-visible` on MUI Button/IconButton/Dialog in `theme.js` (shell/public have local rings). Legacy sidebar `minHeight: 34`. Canonical item height 40 vs token `touchTargetMin: 44`. |
| MAJOR | Sparse `aria-invalid` / `aria-describedby` on forms; unlabeled IconButtons in feature panels; `window.confirm` not in-page dialog; table caption/`scope` not shared; tooltip-only risk outside Canonical collapsed nav. |
| MINOR | `prefers-reduced-motion` not in global theme; dense table/chip hit areas; no shared `aria-live` for toasts. |

Details: `ACCESSIBILITY_MATRIX.md`.

---

## 10. Test / explorer snapshot

| Item | Current |
|------|---------|
| COMPONENT_EXPLORER_CURRENT | **NONE** — no Storybook / Ladle / Histoire |
| VISUAL_REGRESSION_CURRENT | **NONE** — Playwright exists for shell/QA evidence, not DS snapshots |
| DESIGN_SYSTEM_TEST_GAPS | No token snapshot tests; no primitive a11y tests; no PageHeader/Table contract tests. Wave 1 tests **must remain** the shell/breakpoint lock. |

Do **not** add Storybook in 2A.

---

## 11. Validation (this batch)

```
APPLICATION_CODE_CHANGED=NO
DOMAIN_CODE_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
AUTHORIZATION_CHANGED=NO
TOURNAMENT_23_CHANGED=NO
PUBLIC_WEB_CHANGED=NO
SQL_EXECUTED=NO
STAGING_MUTATED=NO
PRODUCTION_MUTATED=NO
IMPLEMENTATION_STARTED=NO
```

---

## 12. Artifact index

| File | Purpose |
|------|---------|
| `THEME_TOKEN_INVENTORY.md` | Every theme/token system |
| `SHARED_COMPONENT_INVENTORY.md` | Component map + public/auth/global counts |
| `BUTTON_ACTION_MATRIX.md` | Buttons / actions |
| `CARD_SURFACE_MATRIX.md` | Cards / surfaces |
| `TABLE_GRID_MATRIX.md` | Tables / DataGrid / W6-PAGE-002 |
| `FORM_CONTROL_MATRIX.md` | Forms |
| `STATUS_FEEDBACK_MATRIX.md` | Chips + loading/empty/error/toast |
| `PAGE_HEADER_DIALOG_MATRIX.md` | Page headers vs TopBar; dialogs |
| `ACCESSIBILITY_MATRIX.md` | A11y gaps |
| `DESIGN_SYSTEM_OWNERSHIP_MATRIX.md` | Owner classification |
| `DESIGN_SYSTEM_GAP_MATRIX.md` | KEEP / ADAPT / CONSOLIDATE / DEPRECATE |
| `WAVE2_DELIVERY_PLAN.md` | Batches, migration, tests |

```
NEXT_BATCH=OWNER_REVIEW_THEN_2B_FOUNDATIONS_TOKENS
STOP_NOW=YES
```
