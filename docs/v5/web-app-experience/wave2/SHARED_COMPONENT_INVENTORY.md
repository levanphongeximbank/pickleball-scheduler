# SHARED COMPONENT INVENTORY — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY  
There is **no** `src/ui/`, `src/shared/`, `src/common/`, or design-system / atoms package.

```
PUBLIC_SHARED_COMPONENT_COUNT=19
AUTHENTICATED_SHARED_COMPONENT_COUNT=37
TRULY_GLOBAL_SHARED_COMPONENT_COUNT=3
DUPLICATE_SHARED_COMPONENT_FAMILIES=13
```

---

## 1. Location map

| Location | Role |
|----------|------|
| `src/theme/` | Tokens + MUI theme (Layer 0) |
| `src/features/canonical-shell/` | Frozen Wave 1 chrome |
| `src/components/` | Mixed: public, tournament, players, courts, shell, auth |
| `src/features/club/ui/` | Strongest **non-frozen** authenticated kit |
| `src/features/tournament/experience-a1/visual/` | Frozen tournament language |
| `src/features/mobile/components/ResponsiveDataView.jsx` | Best table wrapper (lives in mobile feature) |
| `src/layouts/` | `MainLayout` (auth host), `public/PublicLayout` |

---

## 2. Boundary counts (methodology)

### PUBLIC_SHARED (19)

Named public presentation components / states / layout chrome. **Not** forced onto authenticated app.

1. `PublicLayout`  
2. `PublicHeader`  
3. `PublicFooter`  
4. `PublicSectionHeader`  
5. `HeroSection`  
6. `StatsSection`  
7. `LiveScorePreview`  
8. `LiveDataHubSection`  
9. `EcosystemCard`  
10. Public `TournamentCard`  
11. Public `CourtCard`  
12. Public `ClubCard`  
13. `PublicLoadingState`  
14. `PublicEmptyState`  
15. `PublicErrorState`  
16. `PublicUnavailableState`  
17. `PublicDataSourceNotice`  
18. `publicCtaButtonSx`  
19. `publicGhostButtonSx`  

### AUTHENTICATED_SHARED (37)

**Wave 1 chrome (FROZEN, 14):** CanonicalAppShell, Sidebar, SidebarSection, SidebarItem, SidebarSubmenu, TopBar, Breadcrumbs, MobileDrawer, HelpButton, NotificationButton, GlobalSearch, GlobalSearchTrigger, UserMenu, TenantSwitcher.

**Shared chrome reused by Wave 1 (5):** ClubSwitcher, VenueSwitcher, ClusterSwitcher, AccountMenu, MobileBottomNav.

**Cross-module auth primitives (18):** PermissionGate, ForbiddenPage, ComingSoonPage, PlatformContextReadinessGate, ClubPageShell, ClubConfirmDialog, ClubEmptyState, ClubFeedbackAlert, ClubStatusBadge, ClubCard, ClubRegistrySkeleton, ClubDiscoverSkeleton, TournamentPageHeader, TournamentUiState, ResponsiveDataView, KpiCard, DashboardEmptyState, InterventionFeedbackSnackbar.

(`TournamentEmptyState.jsx` is an older duplicate of `TournamentUiState` empty — counted in the empty-state family, not in this 18.)

(14+5+18 = 37.)

### TRULY_GLOBAL_SHARED (3)

Used on **both** public and authenticated trees without being public-only styling:

1. Root MUI `ThemeProvider` + `theme.js` / `designTokens` (public still wraps in the same provider)  
2. `CssBaseline`  
3. `UserAvatar` (`src/components/identity/UserAvatar.jsx` — PublicHeader + auth menus)

---

## 3. Duplicate families (13)

| # | PURPOSE | IMPLEMENTATIONS | FILES (representative) | ACTIVE_USAGE | CANONICAL_CANDIDATE | ACTION |
|---|---------|-----------------|------------------------|--------------|---------------------|--------|
| 1 | App theme | Slate MUI + nested Figure 1 + CSS islands | `theme.js`, `figure1ShellTheme.js`, anim/bracket CSS | All routes + shell | `theme.js` | KEEP_CANONICAL + FROZEN shell overlay |
| 2 | Page header | Experience, Center, Tournament, ClubPageShell, Director, PublicSection, Bracket, ad-hoc h4/h5 | see PAGE_HEADER matrix | High | ClubPageShell API | ADAPT_CANONICAL; Experience FROZEN |
| 3 | Empty state | Club, Tournament×2, Public, Dashboard, Billing, Messaging, Finance | 8 families | High | ClubEmptyState + TournamentUiState shape | CONSOLIDATE_LATER |
| 4 | Loading | CircularProgress stacks, Alert “Đang tải”, Club skeletons, DrawRoom | 9 patterns | High | TournamentLoadingState API + Club skeletons | CONSOLIDATE_LATER |
| 5 | Error / 403 | TournamentError, PublicError, ForbiddenPage, DirectorAccessDenied, MobileForbidden, domain Unavailable | 9 | High | ForbiddenPage (403); TournamentErrorState (inline) | KEEP 403; ADAPT inline |
| 6 | Status chip | 16 named chips/badges | Experience, Tournament, Club, rating, check-in… | High | Tone model from ExperienceStatusChip | ADAPT_CANONICAL visual only; DOMAIN chips FEATURE_SPECIFIC_KEEP |
| 7 | Button styles | theme MUI + Experience sx + draw-room + showcase + public CTA | 11 | High | MUI Button via theme.js | KEEP_CANONICAL |
| 8 | Metric card | Dashboard StatCard local, KpiCard, CenterKpiCard, TournamentKpiCard | 4 | Medium | KpiCard | ADAPT_CANONICAL; Experience KPI FROZEN |
| 9 | Entity card | PlayerCard, CourtCard, ClubCard, public catalog cards | 6+ | High | MUI Card; domain cards stay domain | FEATURE_SPECIFIC_KEEP |
| 10 | Table | MUI Table, ResponsiveDataView, 8 `*Table*.jsx`, Experience tables, AuditLog inline | 12 | High | MUI Table + ResponsiveDataView | ADAPT_CANONICAL |
| 11 | Search | GlobalSearch, CanonicalGlobalSearch, CourtManagementSearchBar, PlayerFilters | 4 | High | CanonicalGlobalSearch (shell FROZEN); page filters ADAPT | CONSOLIDATE_LATER (legacy GlobalSearch) |
| 12 | Confirm | ClubConfirmDialog + domain dialogs + `window.confirm` (~10 files) | 14 | High | ClubConfirmDialog | ADAPT_CANONICAL |
| 13 | Toast | InterventionFeedbackSnackbar + 4 page Snackbars | 5 | Low | InterventionFeedbackSnackbar | ADAPT_CANONICAL |

Do **not** delete anything in 2A.

---

## 4. Missing shared primitives (gaps, not builds)

| Missing | Closest existing | Wave |
|---------|------------------|------|
| Auth PageHeader | ClubPageShell | 2D |
| StatusToneChip | ExperienceStatusChip (frozen) | 2C |
| Global ConfirmDialog | ClubConfirmDialog | 2D |
| LoadingButton | `disabled` + “Đang xử lý…” | 2C |
| FilterBar | per-page Select stacks | 2D |
| TablePagination UI | **none** (`TablePagination` unused) | 2D / Wave 6 |
| FieldError | ad-hoc helperText | 2C |
| AppSnackbar provider | InterventionFeedbackSnackbar | 2D |
| Shared Skeleton | Club skeletons only (~16 Skeleton tags) | 2D |
| DatePicker | HTML `type="date"` / `datetime-local` | not Wave 2 unless Owner GO |

---

## 5. Icon libraries

```
ICON_LIBRARY_COUNT=1
PRIMARY_ICON_LIBRARY=@mui/icons-material
MIXED_ICON_GAPS=none at library level; unlabeled IconButtons in feature panels
```

`package.json` has `@fontsource/inter` and `@fontsource/plus-jakarta-sans` (fonts, not icons). No lucide / react-icons / fontawesome.

Do not replace icons in 2A.
