# Batch 1A — Coming Soon MainLayout bypass adjudication

**Date:** 2026-08-22  
**PR:** #463  
**Route:** `/coming-soon/:moduleKey`

## Audit

| Field | Value |
|-------|--------|
| ROUTE_COMPONENT | `ComingSoonPage` (`src/pages/ComingSoonPage.jsx`) |
| ROUTER_DECLARATION_FILE | `src/router.jsx` |
| AUTH_REQUIRED | Yes when Auth production ON (via MainLayout `RouteAccessGate`); route permissions `[]` (menu-gated) |
| ROLES | Menu-filtered: e.g. SYSTEM_TECHNICIAN leaves (`tech-error-log`, `tech-diagnostics`, `tech-support-history`); planned hub leaves via `InPageNavHub` |
| MENU_ENTRIES_LINKING_TO_IT | `src/config/v5Menu/systemTechnicianMenu.js`; planned leaves via `menuBuilders.buildComingSoonPath`; `InPageNavHub` navigates planned items |
| SOURCE_MODULES | `navigationConfig.buildComingSoonPath` / `COMING_SOON_MODULES`; `v5Menu/menuBuilders.js`; hubs |
| PUBLIC_OR_AUTHENTICATED | Authenticated Web App placeholder |
| CURRENT_LAYOUT (before) | Outside MainLayout (chrome-less) |
| CURRENT_LAYOUT (after) | Inside MainLayout → Canonical XOR Legacy |
| TENANT_CONTEXT_REQUIRED | Inherited from MainLayout providers (not route-specific) |
| CLUB_CONTEXT_REQUIRED | Inherited from MainLayout providers (not route-specific) |
| USER_CAN_NAVIGATE_TO_IT_FROM_APP_MENU | YES |
| INTENTIONAL_MAINLAYOUT_EXCEPTION | NO |

## Decision

```
TARGET_LAYOUT=INSIDE_MAINLAYOUT
DECISION_REASON=Authenticated placeholder reached from normal app menu / hub navigation; inventory already expected MainLayout; retain Canonical/Legacy chrome without a new ComingSoon shell.
```

## Remediation

Routing-only: move `<Route path="/coming-soon/:moduleKey" …>` under `<Route element={<MainLayout />}>`.  
No ComingSoonPage visual redesign. No auth/menu/IA changes.

```
AUTHENTICATED_MAINLAYOUT_BYPASS_COUNT_AFTER=0
```
