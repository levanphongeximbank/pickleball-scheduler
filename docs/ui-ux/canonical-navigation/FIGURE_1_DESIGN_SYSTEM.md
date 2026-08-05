# Figure 1 Design System — Canonical Navigation Shell

**Approved visual direction** for PICK_VN Canonical Navigation Program Phase 2+ implementation.

This document translates the approved Figure 1 mockup direction into implementable design tokens and component specifications. No runtime code changes in Phase 1.

---

## Design Principles

1. **Dark navy sidebar** — persistent business domain navigation (Level-1 + Level-2)
2. **Clean white workspace** — content-first; minimal chrome
3. **Rounded feature cards** — module entry points and dashboard widgets
4. **Compact top navigation** — tenant context, search, notifications, account
5. **Clear module grouping** — 13 Level-1 domains with visual separation
6. **Modern Vietnamese SaaS** — professional, approachable, high information density without clutter

---

## Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--nav-sidebar-bg` | `#0F1B2D` | Sidebar background (dark navy) |
| `--nav-sidebar-bg-hover` | `#162236` | Sidebar item hover |
| `--nav-sidebar-active` | `#1E3A5F` | Active menu item background |
| `--nav-sidebar-text` | `#E8EDF4` | Primary sidebar text |
| `--nav-sidebar-text-muted` | `#8B9CB3` | Group labels, secondary text |
| `--nav-sidebar-accent` | `#3B82F6` | Active indicator, focus ring |
| `--nav-workspace-bg` | `#FFFFFF` | Main content area |
| `--nav-workspace-surface` | `#F8FAFC` | Page background, subtle sections |
| `--nav-topbar-bg` | `#FFFFFF` | Top navigation bar |
| `--nav-topbar-border` | `#E2E8F0` | Bottom border separator |
| `--nav-card-bg` | `#FFFFFF` | Feature cards |
| `--nav-card-border` | `#E2E8F0` | Card outline |
| `--nav-card-shadow` | `0 1px 3px rgba(15,27,45,0.08)` | Card elevation |
| `--nav-badge-partial` | `#F59E0B` | PARTIAL feature badge |
| `--nav-badge-soon` | `#6B7280` | COMING_SOON badge |
| `--nav-badge-live` | `#10B981` | LIVE feature badge |

---

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Sidebar group label | Inter / system | 11px | 600 uppercase, letter-spacing 0.05em |
| Sidebar item | Inter / system | 14px | 500 |
| Sidebar item active | Inter / system | 14px | 600 |
| Topbar title | Inter / system | 16px | 600 |
| Page heading | Inter / system | 24px | 700 |
| Card title | Inter / system | 16px | 600 |
| Card description | Inter / system | 13px | 400 |
| Breadcrumb | Inter / system | 13px | 400 |

**Locale:** Vietnamese primary; allow mixed EN for technical terms (VPR, QR, AI).

---

## Layout Specifications

### Sidebar (desktop)

| Property | Value |
|----------|-------|
| Width expanded | 260px |
| Width collapsed | 64px (icon-only) |
| Position | Fixed left, full viewport height |
| Z-index | 1200 (below modals) |
| Border right | 1px solid `rgba(255,255,255,0.06)` |
| Scroll | Vertical auto; group headers sticky |

**Structure:**
```
┌─────────────────────┐
│ Logo + collapse btn │
├─────────────────────┤
│ Level-1 Group       │  ← accordion header (11px caps)
│   Level-2 Item      │  ← 14px, 40px row height
│   Level-2 Item      │
│ Level-1 Group       │
│   ...               │
├─────────────────────┤
│ Support / Profile   │  ← pinned bottom section
└─────────────────────┘
```

**Max depth:** 2 visible levels in sidebar (group → leaf). Level-3 renders as in-page hub tabs per `InPageNavHub.jsx`.

### Top navigation (compact)

| Property | Value |
|----------|-------|
| Height | 56px |
| Background | White |
| Shadow | None; 1px bottom border only |
| Left | Breadcrumb trail (when available) |
| Center | Global search trigger (Cmd+K) |
| Right | Club/Season/League selectors → Notifications → Account menu |

### Workspace

| Property | Value |
|----------|-------|
| Background | `#F8FAFC` |
| Content max-width | 1440px (centered) |
| Padding | 24px desktop / 16px mobile |
| Card grid gap | 16px |
| Card border-radius | 12px |
| Card padding | 20px |

### Feature cards (module entry)

```
┌──────────────────────────────┐
│  [icon]  Module Title        │
│          Short description   │
│          ─────────────       │
│          → Action link       │
└──────────────────────────────┘
```

- Border-radius: 12px
- Hover: elevate shadow + accent left border 3px
- Icon container: 40×40px, rounded 8px, accent tint background

---

## Navigation States

| State | Sidebar item style |
|-------|-------------------|
| Default | Text `#E8EDF4`, no background |
| Hover | Background `#162236` |
| Active | Background `#1E3A5F`, left accent bar 3px `#3B82F6`, text white |
| Disabled | Text `#4B5563`, no pointer |
| Partial badge | Amber dot + "Một phần" chip |
| Coming soon | Gray chip, reduced opacity 0.7 |
| Shadow/hidden | Not rendered in sidebar |

---

## Mobile Adaptation

| Breakpoint | Behavior |
|------------|----------|
| `< md (900px)` | Sidebar hidden; bottom nav + drawer |
| Bottom nav | 56px height, white bg, top border |
| Drawer | 280px, reuses sidebar tree (light variant on mobile optional) |
| Top bar | Compress selectors into hamburger context |

**Bottom nav icons:** 24px, label 10px below, max 5 items + "More" drawer.

---

## Component Mapping (Phase 2 targets)

| Figure 1 element | Current component | Phase 2 action |
|------------------|-------------------|----------------|
| Dark sidebar | `Sidebar.jsx` → `NavMenuShell` | Apply navy theme tokens |
| Compact topbar | `Header.jsx` | Reduce height 64→56px |
| Feature cards | Dashboard widgets, hub pages | Standardize card component |
| In-page Level-3 | `InPageNavHub.jsx` | Tab strip below page title |
| Global search | `GlobalSearch.jsx` | Fix nested leaf indexing |
| Breadcrumbs | Page-local | Introduce `BreadcrumbProvider` |
| Role zones | `navigationConfig.js` overlays | Style as sidebar sections |

---

## Accessibility

- Sidebar items: `aria-current="page"` on active route
- Focus visible: 2px `#3B82F6` outline offset 2px
- Color contrast: sidebar text ≥ 4.5:1 against `#0F1B2D`
- Keyboard: arrow keys within sidebar tree; Escape closes mobile drawer
- Screen reader: group labels as `role="group"` with `aria-label`

---

## MUI Theme Integration Notes

Extend existing MUI theme in Phase 2:

```javascript
// Proposed palette extension (documentation only)
palette: {
  nav: {
    sidebar: { main: '#0F1B2D', contrastText: '#E8EDF4' },
    accent: { main: '#3B82F6' },
  },
},
components: {
  MuiDrawer: { /* sidebar paper bg */ },
  MuiAppBar: { /* compact topbar */ },
  MuiCard: { /* rounded feature cards, borderRadius: 12 */ },
}
```

---

## What Figure 1 Does NOT Change (Phase 1 constraint)

- Route paths remain unchanged
- RBAC logic remains unchanged
- No production deployment
- Menu item keys remain stable for telemetry continuity

---

## Reference

- Inventory: [`CANONICAL_ROUTE_INVENTORY.md`](./CANONICAL_ROUTE_INVENTORY.md)
- Implementation plan: [`NAVIGATION_IMPLEMENTATION_PLAN.md`](./NAVIGATION_IMPLEMENTATION_PLAN.md)

**Review binding (2026-08-05):** Phase 1 review pass. Owner decisions B01–B03 bound to proposed canonical registry. Runtime unchanged until Phase 3.
