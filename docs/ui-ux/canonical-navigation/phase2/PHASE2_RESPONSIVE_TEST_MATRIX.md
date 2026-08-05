# Phase 2 Responsive Test Matrix

| Scenario | Expected behavior | Evidence |
|----------|-------------------|----------|
| Desktop expanded sidebar | Persistent drawer width 260px | `FIGURE1_LAYOUT.sidebarWidthExpanded` + CanonicalSidebar |
| Desktop collapsed sidebar | Icon-only width 64px; toggle button aria-expanded | CanonicalSidebar collapse control |
| Tablet | Collapsible persistent sidebar (same as desktop path; md–lg) | CanonicalShellProvider `isTablet`; drawer reserved for mobile |
| Mobile drawer | Temporary drawer 280px; L1→L2→L3 stack | CanonicalMobileDrawer |
| Level-1 expansion | Accordion `aria-expanded` + Collapse | CanonicalSidebarSection |
| Level-2 expansion | Submenu toggle / auto-open on active child | CanonicalSidebarSubmenu |
| Level-3 navigation | Leaf NavLink navigation | CanonicalSidebarItem |
| No horizontal overflow | `overflowX: hidden` on sidebar paper; content `minWidth: 0` | CanonicalSidebar / CanonicalAppShell |
| Top-bar usable on mobile | Hamburger + search + notifications + account | CanonicalTopBar |
| Reduced motion | Transition disabled under `prefers-reduced-motion` | CanonicalSidebar / CanonicalSidebarItem |
| Touch targets | ≥44px targets on interactive chrome | `layout.touchTargetMin` |

## Automated contracts

`tests/canonical-shell-phase2.test.js` — responsive + a11y source contracts  
`tests/ui/canonical-shell-phase2.ui.test.jsx` — flag ON/OFF shell mount

Manual browser QA of every viewport remains recommended before Production flag enablement (out of Phase 2 scope).
