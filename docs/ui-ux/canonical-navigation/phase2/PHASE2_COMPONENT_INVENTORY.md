# Phase 2 Component Inventory

Mandatory Figure 1 shell components (Phase 2).

| Required responsibility | Implementation path | Notes |
|-------------------------|---------------------|-------|
| CanonicalAppShell | `src/features/canonical-shell/components/CanonicalAppShell.jsx` | Flag-gated shell; wires gates + Outlet |
| CanonicalSidebar | `src/features/canonical-shell/components/CanonicalSidebar.jsx` | Desktop/tablet navy sidebar |
| CanonicalSidebarSection | `src/features/canonical-shell/components/CanonicalSidebarSection.jsx` | Level-1 accordion |
| CanonicalSidebarItem | `src/features/canonical-shell/components/CanonicalSidebarItem.jsx` | Leaf item + active state |
| CanonicalSidebarSubmenu | `src/features/canonical-shell/components/CanonicalSidebarSubmenu.jsx` | Level-2/3 expansion |
| CanonicalTopBar | `src/features/canonical-shell/components/CanonicalTopBar.jsx` | 56px top bar |
| CanonicalBreadcrumbs | `src/features/canonical-shell/components/CanonicalBreadcrumbs.jsx` | Registry-driven trail |
| CanonicalMobileDrawer | `src/features/canonical-shell/components/CanonicalMobileDrawer.jsx` | Mobile L1→L2→L3 drill-down |
| CanonicalTenantSwitcher | `src/features/canonical-shell/components/CanonicalTenantSwitcher.jsx` | Wraps existing TenantSwitcher |
| CanonicalUserMenu | `src/features/canonical-shell/components/CanonicalUserMenu.jsx` | Wraps existing AccountMenu |
| CanonicalNotificationButton | `src/features/canonical-shell/components/CanonicalNotificationButton.jsx` | Existing inbox runtime |
| CanonicalGlobalSearchTrigger | `src/features/canonical-shell/components/CanonicalGlobalSearchTrigger.jsx` | Reuses GlobalSearch |

## Supporting modules

| Module | Path |
|--------|------|
| Feature flag | `src/features/canonical-shell/flags.js` |
| Runtime barrel (node-safe) | `src/features/canonical-shell/runtime.js` |
| Public barrel | `src/features/canonical-shell/index.js` |
| Menu data | `src/features/canonical-shell/config/canonicalMenuData.js` |
| Menu tree builder | `src/features/canonical-shell/config/canonicalMenuRegistry.js` |
| Owner decisions | `src/features/canonical-shell/config/ownerDecisions.js` |
| Filter / RBAC | `src/features/canonical-shell/services/filterCanonicalMenu.js` |
| Route match | `src/features/canonical-shell/services/matchCanonicalRoute.js` |
| Breadcrumbs | `src/features/canonical-shell/services/buildCanonicalBreadcrumbs.js` |
| Shell provider | `src/features/canonical-shell/context/CanonicalShellProvider.jsx` |
| Shell hook | `src/features/canonical-shell/hooks/useCanonicalShell.js` |
| Figure 1 tokens | `src/theme/figure1Tokens.js` |

## Modified existing files

| File | Change |
|------|--------|
| `src/layouts/MainLayout.jsx` | Flag switch: CanonicalAppShell vs LegacyMainLayoutContent |
| `src/theme/theme.js` | Attach `theme.canonicalNav` / `theme.figure1` |
| `scripts/ci/unit-test-files.json` | Register phase2 unit tests |

## Legacy components retained (rollback)

- `src/components/Sidebar.jsx`
- `src/components/Header.jsx`
- `src/features/mobile/layout/MobileDrawer.jsx`
- `src/components/nav/NavMenuShell.jsx`
