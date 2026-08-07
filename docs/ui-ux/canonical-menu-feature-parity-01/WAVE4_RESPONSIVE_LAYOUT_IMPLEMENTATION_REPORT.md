# Wave 4 — Canonical topbar responsive layout remediation

**Program:** CANONICAL-NAVIGATION-FINAL-PARITY-01  
**Branch:** `fix/canonical-navigation-final-parity-01`  
**Starting HEAD:** `248cb430` (Wave 3 PASS)  
**Observation:** `OBSERVATION_CANONICAL_TOPBAR_01`  
**Classification:** `LOCALLY_VERIFIED_CLOSED_PENDING_PRODUCTION_ACCEPTANCE` (Wave 4 independent re-review PASS)  
**Production closure:** NOT claimed

## Root cause

Canonical topbar placed breadcrumbs, organization (tenant) selector, and search in adjacent flex regions without:

1. consistent `minWidth: 0` + zone `maxWidth` budgets per breakpoint;
2. text truncation on breadcrumb crumbs and organization `Select` value;
3. breadcrumb list `flexWrap: nowrap` (crumbs wrapped/collided into the selector);
4. tablet-specific collapse of long breadcrumb trails.

Result: selector label (“Đang quản trị” / “Chọn tổ chức…”) visually overlapped page-context breadcrumb text at mid desktop / tablet widths.

## Components changed (runtime implementation — Wave 4 commit)

| File | Change |
|------|--------|
| `layout/canonicalTopbarLayout.js` | Deterministic zone contracts + overlap budgets |
| `CanonicalTopBar.jsx` | Zone-based layout; viewport-aware visibility |
| `CanonicalBreadcrumbs.jsx` | Ellipsis truncation; nowrap trail |
| `CanonicalTenantSwitcher.jsx` | Passes bounded min/max width |
| `TenantSwitcher.jsx` | Ellipsis on selected value; optional maxWidth |
| `CanonicalGlobalSearchTrigger.jsx` | Honors parent zone maxWidth |
| `runtime.js` | Exports layout helpers |

**Responsive runtime behavior:** unchanged by the breakpoint evidence correction commit.

## FIGURE1 breakpoint authority (source of truth)

`CanonicalTopBar` runtime viewports: **`mobile` | `tablet` | `desktop` only**.

| Class | Width (CSS px) | Representative widths |
|-------|----------------|------------------------|
| **Mobile** | `≤899` (`mobileMax`) | 375, 390, 430, 600, **768** |
| **Tablet** | `900–1199` | **900**, **1024**, 1199 |
| **Desktop** | `≥1200` (`desktopMin`) | **1200**, 1280, 1366, 1440, 1920 |

Boundary assertions:

| Width | Classification |
|------:|----------------|
| 899 | mobile |
| 900 | tablet |
| 1199 | tablet |
| 1200 | desktop |

### `wide` status

Zone key `wide` in `canonicalTopbarLayout.js` is **`HELPER_ONLY_NON_RUNTIME_PRESET`**.

- `WIDE_CLAIMED_AS_RUNTIME_VIEWPORT=NO`
- `CanonicalTopBar` never resolves `viewport === "wide"`
- Helper may be exercised in isolation tests; it is **not** CanonicalTopBar runtime evidence

## Layout behavior (runtime contracts)

### Desktop (`≥1200`, e.g. 1200 / 1280 / 1366 / 1440 / 1920)
- Context zone ≤ 320px, org ≤ 220px, search ≤ 420px
- Breadcrumbs up to 4 items; overflow ellipsized
- Organization selector truncates long names with native `title`
- Actions zone never shrinks

### Tablet (`900–1199`, e.g. 900 / 1024)
- Context ≤ 200px, org ≤ 160px, search ≤ 220px
- Breadcrumbs collapsed to first + last (max 2)
- Same overflow/ellipsis rules

### Mobile (`≤899`, including **768** / 600 / 430 / 390 / 375)
- Context + organization zones **hidden** (drawer owns navigation)
- Search ≤ 160px; menu trigger + actions remain
- Toolbar `overflowX: hidden` — no horizontal shell overflow from topbar

## Accessibility

- Organization select keeps full label in `title` when visually truncated
- Breadcrumb links/current page keep `title` with full text
- Menu / notification / account controls retain touch targets and aria labels
- Focus-visible ring on mobile menu trigger preserved

## Gates (local + independent browser QA)

| Gate | Value |
|------|------:|
| TOPBAR_TEXT_OVERLAP | 0 |
| TOPBAR_TEXT_COLLISION | 0 |
| CRITICAL_LABEL_CLIPPING | 0 |
| TOPBAR_CAUSED_HORIZONTAL_OVERFLOW | 0 |
| BREAKPOINT_EDGE_COLLISION_COUNT | 0 |
| UNSAFE_CRITICAL_TRUNCATION | 0 |
| ACCESSIBILITY_REGRESSION | 0 |
| DESKTOP_LAYOUT_PARITY | PASS |
| TABLET_LAYOUT_PARITY | PASS |
| MOBILE_LAYOUT_PARITY | PASS |
| WAVE4_EVIDENCE_RUNTIME_MISMATCH_COUNT | 0 (after correction) |

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

## Independent review finding + evidence correction

Independent review (`WAVE4_INDEPENDENT_REVIEW_BLOCKED`) found evidence/test mismatch:

1. Docs/tests treated **768 → tablet**; runtime FIGURE1 classifies **768 → mobile**
2. Tests treated **`wide` as runtime-equivalent**; `CanonicalTopBar` only emits `mobile|tablet|desktop`

**Correction (this commit):** docs + tests aligned to FIGURE1; `wide` demoted to helper-only; **no responsive layout rewrite**.

### Browser QA evidence preserved (geometry unchanged; classification corrected)

Pages: `/dashboard`, `/tournament`, `/tournament/create`, `/admin/tenants`, `/customers/athletes/staff-directory`

| Width | Runtime class | Visual | Notes |
|------:|---------------|--------|-------|
| 1920 / 1440 / 1366 / 1280 / 1200 | desktop | PASS | context + org visible |
| 1024 / 900 | tablet | PASS | context + org; breadcrumb collapse |
| **768** | **mobile** | **PASS** | CONTEXT_ZONE=hidden; ORGANIZATION_ZONE=hidden; NO_OVERLAP=YES |
| 600 / 430 / 390 / 375 | mobile | PASS | drawer + search + actions |

Observation remains **`PROPOSED_CLOSED_BY_IMPLEMENTATION`** until independent **re-review**. Expected post re-review: `LOCALLY_VERIFIED_CLOSED_PENDING_PRODUCTION_ACCEPTANCE`. Do **not** claim Production closure.

## Safety

Production / Vercel / SQL / auth / data / push / PR: **NO**
