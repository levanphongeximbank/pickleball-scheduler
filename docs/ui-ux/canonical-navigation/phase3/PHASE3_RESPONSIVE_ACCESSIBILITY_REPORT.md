# Phase 3 Responsive & Accessibility Report

## Responsive

| Viewport | Behavior |
|----------|----------|
| Desktop (≥1200) | Permanent navy sidebar 260/64; top bar 56px |
| Tablet (900–1199) | Collapsible sidebar; same registry |
| Mobile (<900) | Drawer drill-down L1→L2→L3; bottom nav retained |

Desktop and mobile consume the **same** filtered registry (`filterCanonicalMenu`).

## Accessibility — W05 CLOSED

| Requirement | Implementation |
|-------------|----------------|
| Focus moves into drawer when opened | Focus to close/back control via `closeButtonRef` |
| Escape closes drawer | MUI Modal/Drawer default |
| Focus returns to trigger | `menuTriggerRef` + `restoreTriggerFocus` / `onExited` |
| Keyboard traversal | Tab order within drawer list; focus-visible outlines |
| Focus trap | MUI Modal focus trap |
| Touch targets | ≥44px (`layout.touchTargetMin`) |

## Typography — W01 CLOSED

- `@fontsource/inter` weights 400/500/600/700
- `font-display: swap`
- Stack: Inter → DM Sans → Segoe UI → system-ui
- Loaded only when canonical shell mounts (flag ON)
- No remote CDN / secrets

## Card radius — W03 CLOSED

- Nested `ThemeProvider` + `createFigure1ShellTheme`
- `MuiCard` borderRadius = 12 inside canonical shell only
- Global dialogs/tables/default theme unchanged when flag OFF

## Parameterized labels — W04 CLOSED

- Never navigate/label with literal `"active"`
- Breadcrumbs use registry labels + Vietnamese param fallbacks
- Unauthorized crumbs fail closed (`Không có quyền truy cập`)
- Mobile href resolver uses current params or safe hub (`/tournaments`)
