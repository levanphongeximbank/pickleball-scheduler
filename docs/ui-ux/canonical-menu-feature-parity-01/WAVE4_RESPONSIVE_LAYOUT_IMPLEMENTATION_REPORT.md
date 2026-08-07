# Wave 4 — Canonical topbar responsive layout remediation

**Program:** CANONICAL-NAVIGATION-FINAL-PARITY-01  
**Branch:** `fix/canonical-navigation-final-parity-01`  
**Starting HEAD:** `248cb430` (Wave 3 PASS)  
**Observation:** `OBSERVATION_CANONICAL_TOPBAR_01`  
**Classification after local PASS:** `PROPOSED_CLOSED_BY_IMPLEMENTATION`  
**Production closure:** NOT claimed (browser verification still required)

## Root cause

Canonical topbar placed breadcrumbs, organization (tenant) selector, and search in adjacent flex regions without:

1. consistent `minWidth: 0` + zone `maxWidth` budgets per breakpoint;
2. text truncation on breadcrumb crumbs and organization `Select` value;
3. breadcrumb list `flexWrap: nowrap` (crumbs wrapped/collided into the selector);
4. tablet-specific collapse of long breadcrumb trails.

Result: selector label (“Đang quản trị” / “Chọn tổ chức…”) visually overlapped page-context breadcrumb text at mid desktop / tablet widths.

## Components changed

| File | Change |
|------|--------|
| `layout/canonicalTopbarLayout.js` | Deterministic zone contracts + overlap budgets |
| `CanonicalTopBar.jsx` | Zone-based layout; viewport-aware visibility |
| `CanonicalBreadcrumbs.jsx` | Ellipsis truncation; nowrap trail |
| `CanonicalTenantSwitcher.jsx` | Passes bounded min/max width |
| `TenantSwitcher.jsx` | Ellipsis on selected value; optional maxWidth |
| `CanonicalGlobalSearchTrigger.jsx` | Honors parent zone maxWidth |
| `runtime.js` | Exports layout helpers |

## Layout behavior

### Desktop (1280 / 1366 / 1440 / 1920)
- Context zone ≤ 320–420px, org ≤ 220–260px, search ≤ 420–520px
- Breadcrumbs up to 4 items; overflow ellipsized
- Organization selector truncates long names with native `title`
- Actions zone never shrinks

### Tablet (768 / 1024)
- Context ≤ 200px, org ≤ 160px, search ≤ 220px
- Breadcrumbs collapsed to first + last (max 2)
- Same overflow/ellipsis rules

### Mobile (375 / 390 / 430)
- Context + organization zones hidden (drawer owns navigation)
- Search ≤ 160px; menu trigger + actions remain
- Toolbar `overflowX: hidden` — no horizontal shell overflow from topbar

## Accessibility

- Organization select keeps full label in `title` when visually truncated
- Breadcrumb links/current page keep `title` with full text
- Menu / notification / account controls retain touch targets and aria labels
- Focus-visible ring on mobile menu trigger preserved

## Gates (local)

| Gate | Value |
|------|------:|
| TOPBAR_TEXT_OVERLAP | 0 |
| TOPBAR_TEXT_COLLISION | 0 |
| CRITICAL_LABEL_CLIPPING | 0 |
| DESKTOP_LAYOUT_PARITY | PASS (contract) |
| TABLET_LAYOUT_PARITY | PASS (contract) |
| MOBILE_LAYOUT_PARITY | PASS (contract) |

## Wave 1–3 preservation

| Metric | Value |
|--------|------:|
| Proposed nodes | 120 |
| Wave1 tournament targets | 13 |
| B02 allowlist | 11 |
| B03 sidebar | hidden |
| Visible labels | 379 / 379 (100%) |
| `dashboard_no_live_rows` mapping | preserved |
| RBAC / permissions / private pairing | unchanged |

## Browser verification (later — not Production)

Checklist for Owner/preview verification:

1. Desktop 1920 / 1440 / 1366 / 1280 — SUPER_ADMIN with long org name + deep breadcrumb path  
2. Tablet 1024 / 768 — same; confirm breadcrumbs collapse and no overlap  
3. Mobile 430 / 390 / 375 — drawer opens; no horizontal scroll from topbar  
4. Confirm Vietnamese labels unchanged (Tổ chức / Chọn tổ chức…)  
5. Keyboard: tab through search, notifications, account  

Do **not** deploy Production to close this observation.

## Safety

Production / Vercel / SQL / auth / data / push / PR: **NO**
