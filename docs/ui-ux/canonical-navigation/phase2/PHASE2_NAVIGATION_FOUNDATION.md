# Phase 2 Navigation Foundation

## Single registry

Runtime source: `src/features/canonical-shell/config/canonicalMenuData.js`  
Derived from Phase 1: `docs/ui-ux/canonical-navigation/CANONICAL_ROUTE_INVENTORY.json`  
Tree builder: `buildCanonicalMenuTree()` in `canonicalMenuRegistry.js`

Desktop and mobile consume the **same** filtered tree (`filterCanonicalMenu`). No duplicated desktop/mobile registries.

## Menu node capabilities

Each foundation node supports:

| Capability | Field |
|------------|-------|
| Stable id | `id` |
| Vietnamese label | `label` / `level1Label` / `level2Label` |
| Optional description | `description` |
| Icon identifier | `icon` |
| Canonical route | `route` |
| Level-1 group | `level1` |
| Level-2 module | `level2` |
| Level-3 action | `level3` |
| Children | `children` |
| Required roles | `requiredRoles` / `rbacVisibility` |
| Required permissions | `requiredPermissions` |
| Feature flag | `featureFlags` |
| Visibility status | `visibilityStatus` (`live` / `partial` / `coming_soon` / `shadow` / `legacy`) |
| Active route matching | `activeMatch` (`exact` / `prefix` / `pattern`) |
| Mobile visibility | `mobileVisible` |
| Desktop visibility | `desktopVisible` |
| Badge / status metadata | `badge` |

## Hierarchy

- **Level-1:** 13 business domains from inventory `level1Groups`
- **Level-2:** 53 modules represented in the foundation tree
- **Level-3:** leaf actions from 82 `proposedCanonicalMenu=true` routes

## Filtering pipeline

`filterCanonicalMenu(auth, { viewport })`:

1. Owner-decision hide (B01/B02/B03)
2. Viewport visibility
3. Private Pairing 4-layer menu gate
4. Feature flags
5. Role / Level-1 access matrix (10 QA personas)
6. Permission checks (when RBAC enabled)

## Active highlighting

`isCanonicalRouteActive` + `findActiveCanonicalNode` support:

- exact (`/dashboard`)
- prefix
- pattern (`/tournaments/:tournamentId/engine`)

## Breadcrumbs

`buildCanonicalBreadcrumbs(pathname)` builds Home → Level-1 → Level-2 → leaf.  
Unknown paths produce an `invalid` crumb (foundation for invalid-route UX).

## Phase boundary

Phase 2 does **not** replace `MENU_GROUPS` / `NavMenuShell` for the legacy shell.  
Canonical registry is used only when `VITE_CANONICAL_APP_SHELL_ENABLED=true`.
