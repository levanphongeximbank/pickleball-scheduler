# APP_SHELL_AUDIT

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY — do not refactor.

## Counts

```
APP_SHELL_COUNT=14
SIDEBAR_IMPLEMENTATIONS=3
TOPBAR_IMPLEMENTATIONS=6
TENANT_SELECTOR_IMPLEMENTATIONS=2
CLUB_SELECTOR_IMPLEMENTATIONS=1
PAGE_HEADER_IMPLEMENTATIONS=5
MOBILE_NAV_IMPLEMENTATIONS=4
```

## Production vs code default

| Question | Finding |
|----------|---------|
| Code default `VITE_CANONICAL_APP_SHELL_ENABLED` | **OFF** (`src/features/canonical-shell/flags.js`) |
| Switch | `src/layouts/MainLayout.jsx` — never both shells |
| Production evidence 2026-08-07 (`docs/ui-ux/canonical-navigation/production-activation-evidence/PRODUCTION_ACTIVATION_FINAL_EVIDENCE.md`) | pickvn.app **ON** (`CanonicalAppShell`, `data-testid="canonical-app-shell"`) |
| Local / `.env.example` | Flag not listed → developers see **legacy** shell |
| Dual-menu risk | Production Canonical registry (120 nodes) vs V5 `MENU_GROUPS` (legacy Sidebar/MobileDrawer) |

**Canonical shared implementation (recommended, not implemented in this workstream):**  
`src/features/canonical-shell/components/CanonicalAppShell.jsx` plus already-shared `TenantSwitcher`, `ClubSwitcher`, `AccountMenu`, `MobileBottomNav`.

## Audit baseline lock

```
CANONICAL_WEB_APP_SHELL=CanonicalAppShell
REUSE=TenantSwitcher,ClubSwitcher,AccountMenu,MobileBottomNav
DO_NOT_BUILD_NEW_APP_SHELL=YES
```

---

## 1. App shells / layouts

| # | File | Used | Flag | Role |
|---|------|------|------|------|
| 1 | `src/layouts/MainLayout.jsx` | Router authenticated group | Host | Providers + shell switch |
| 2 | `src/features/canonical-shell/components/CanonicalAppShell.jsx` | When flag ON | `VITE_CANONICAL_APP_SHELL_ENABLED` | Figure 1 chrome |
| 3 | `LegacyMainLayoutContent` in MainLayout | When flag OFF | inverse | `data-testid="legacy-app-shell"` |
| 4 | `src/layouts/public/PublicLayout.jsx` | Public routes | always | Marketing/catalog |
| 5 | `src/features/tournament/experience-a1/layouts/PublicTournamentExperienceLayout.jsx` | `/tournament/:id/public` | always | No admin chrome |
| 6 | `src/pages/tournament/TournamentShell.jsx` | `/tournament` | `VITE_TOURNAMENT_EXPERIENCE_A1_ENABLED` default ON | Page switcher, not app chrome |
| 7 | `src/pages/courtManagement/CourtManagementLayout.jsx` | Nested court-ops | always | Feature tabs |
| 8 | `src/features/communication/experience/components/MessagingShell.jsx` | `/messages` | always | In-page pane |
| 9 | `src/features/club/ui/ClubPageShell.jsx` | Club/platform pages | always | Page frame |
| 10 | `src/components/tournament/TournamentSetupShell.jsx` | Legacy setup | always | Setup frame |
| 11 | `src/components/tournament/TournamentConfigPageShell.jsx` | Legacy config | always | Config frame |
| 12 | `src/features/tournament/experience-a1/batchC/ExperienceDrawRoomShell.jsx` | Draw rooms | always | Experience |
| 13 | `src/features/tournament/experience-a1/batchB/ExperienceBatchBFrame.jsx` | Most Experience pages | always | Experience |
| 14 | `src/pages/courtManagement/calendar/CourtCalendarShell.jsx` | Calendar | always | Feature sub-shell |

Referee token UI (`RefereeScoreboard`) is **standalone** (no MainLayout). Referee hub/match sit **inside** MainLayout.

---

## 2. Sidebars

| File | When | Menu source |
|------|------|-------------|
| `src/components/Sidebar.jsx` | Legacy desktop | `MENU_GROUPS` / V5 menu |
| `src/features/canonical-shell/components/CanonicalSidebar.jsx` (+ Section/Item/Submenu) | Canonical desktop | `filterCanonicalMenu` + registry |
| `src/components/tournament/bracket/BracketSidebar.jsx` | Bracket UI only | Domain — not app nav |

**Canonical candidate:** `CanonicalSidebar.jsx`.

---

## 3. Topbars / headers

| File | When |
|------|------|
| `src/components/Header.jsx` | Legacy — search, tenant/venue/club, **Help → `/settings`**, notifications, AccountMenu |
| `src/features/canonical-shell/components/CanonicalTopBar.jsx` | Canonical — breadcrumbs, tenant/venue/club, search trigger, notifications, user menu; **no Help** |
| `src/components/public/PublicHeader.jsx` | Public |
| `src/components/shell/AppContextBar.jsx` | Legacy mobile context strip |
| `src/features/tournament/director/components/DirectorHeader.jsx` | Director Mode |
| `src/features/referee-v5/components/RefereeMatchHeader.jsx` | Referee V5 match |

**Canonical candidate:** `CanonicalTopBar.jsx` (add Help later; do not invent a second topbar).

---

## 4. Tenant / club selectors

| Control | File | Used by |
|---------|------|---------|
| Tenant | `src/components/TenantSwitcher.jsx` | Header, AppContextBar, gates |
| Tenant wrapper | `src/features/canonical-shell/components/CanonicalTenantSwitcher.jsx` | CanonicalTopBar → same TenantSwitcher |
| Club | `src/components/ClubSwitcher.jsx` | **Single shared** — Header, AppContextBar, CanonicalTopBar |
| Facility (not club) | `src/components/shell/CurrentFacilitySwitcher.jsx` | Legacy SidebarFooter only |

Related: `VenueSwitcher`, `ClusterSwitcher`, `SeasonLeagueSwitcher` (context bar / gates).

**Canonical candidate:** keep `TenantSwitcher` + `ClubSwitcher` as the only implementations; Canonical wrappers stay thin.

---

## 5. Page headers

| File | Scope |
|------|-------|
| `src/components/tournament/TournamentPageHeader.jsx` | Legacy tournament / hubs / Director |
| `src/features/tournament/experience-a1/visual/ExperiencePageHeader.jsx` | Frozen Experience |
| `src/features/tournament/experience-a1/visual/CenterPageHeader.jsx` | Tournament Center |
| `src/features/club/ui/ClubPageShell.jsx` | Club title + breadcrumbs |
| `src/features/tournament/director/components/DirectorHeader.jsx` | Director composite |

Most non-tournament modules have **no shared PageHeader** (ad-hoc Typography).

**Canonical candidate for future Web App pages:** Experience `ExperiencePageHeader` language (tokens may be generalized in Wave 2 without changing frozen tournament screens).

---

## 6. Mobile navigation

| File | When |
|------|------|
| `src/features/mobile/layout/MobileBottomNav.jsx` | **Both shells** |
| `src/features/mobile/layout/MobileDrawer.jsx` | Legacy — V5 `MENU_GROUPS` |
| `src/features/canonical-shell/components/CanonicalMobileDrawer.jsx` | Canonical — registry L1–L3 |
| Public `PublicHeader` Drawer | Public |

Supporting: `MobileNavProvider`, `mobileNav.js`, `mobileNavAccess.js`, `useIsMobile.js`.

**Canonical candidate:** keep `MobileBottomNav` shared; use `CanonicalMobileDrawer` when shell is Canonical; retire `MobileDrawer` with legacy shell.

---

## 7. Search / notifications / help / profile / breadcrumbs

| Concern | Legacy | Canonical | Shared runtime |
|---------|--------|-----------|----------------|
| Search | `GlobalSearch.jsx` (V5 menu index) | `CanonicalGlobalSearch` + trigger (registry index) | **Duplicated indexes** |
| Notifications | Inline in `Header.jsx` | `CanonicalNotificationButton.jsx` | `useNotificationInbox` |
| Help | Header icon → `/settings` | **Missing** | Menu “Hỗ trợ” |
| Profile | `AccountMenu.jsx` | `CanonicalUserMenu` → AccountMenu | **Shared** |
| Breadcrumbs | None in Header | `CanonicalBreadcrumbs.jsx` | ClubPageShell has its own |

---

## 8. Loading / error / empty in chrome

No shared shell Empty/Error/Loading primitive.

Present: `OfflineBanner`, `PwaInstallPrompt`, `SubscriptionBanner`, `PlatformContextReadinessGate`, `RouteAccessGate` spinner, public `PublicPresentationStates`.

---

## 9. Duplication map (do not fix now)

| Problem | Evidence |
|---------|----------|
| Two app chromes | Flag switch in MainLayout |
| Two sidebars + two drawers | V5 vs Canonical menus diverge |
| Two search indexes | GlobalSearch vs CanonicalGlobalSearch |
| Two page-header families | TournamentPageHeader vs ExperiencePageHeader vs none |
| Help missing on Production shell | CanonicalTopBar |
| Facility switcher only on legacy footer | CurrentFacilitySwitcher |
| Tournament Center vs `?experience=legacy` | TournamentShell |

---

## 10. What must stay separate

- `PublicLayout` (anonymous)
- Referee token scoreboard (session runtime)
- `MessagingShell` (product)
- `CourtManagementLayout` (feature tabs)
- Frozen Experience frames/headers (do not replace with a generic header that regresses Tournament Experience)
