# BATCH 2D — SHARED PATTERN CONTRACT

**WORKSTREAM:** PICK_VN — AUTHENTICATED WEB APP EXPERIENCE  
**WAVE:** WAVE 2 — SHARED DESIGN SYSTEM  
**BATCH:** 2D — CANONICAL SHARED PATTERNS  
**OWNER_GO:** YES  
**PR:** #464  
**PRE_HEAD:** `da38ec494e5bc654597d8399bfd7ae96411e3a24`

## Objective

Establish Layer 2 authenticated shared patterns composed from Layer 0 (theme/tokens) + Layer 1 (primitives). No broad business-page migration (Batch 2E).

## Location

```
SHARED_PATTERN_LOCATION=src/features/web-app-ui/
OWNERSHIP=AUTHENTICATED_SHARED
```

| Pattern | File | Adapted from |
|---------|------|----------------|
| AuthPageHeader | `AuthPageHeader.jsx` | ClubPageShell header slice |
| AuthConfirmDialog | `AuthConfirmDialog.jsx` | ClubConfirmDialog |
| AuthEmptyState | `AuthEmptyState.jsx` | ClubEmptyState shape (no domain presets) |
| AuthLoadingState | `AuthLoadingState.jsx` | Common loading composition |
| AuthErrorState | `AuthErrorState.jsx` | Common error/retry composition |
| AuthResponsiveDataView | `AuthResponsiveDataView.jsx` | ResponsiveDataView ideas (no feature import) |
| AuthFilterBar | `AuthFilterBar.jsx` | Shared filter composition slots |
| AppSnackbar | `AppSnackbar.jsx` | InterventionFeedbackSnackbar |
| AuthPatternHarness | `AuthPatternHarness.jsx` | Isolated evidence only |

## Contracts

### AuthPageHeader

- Page content below CanonicalTopBar (Wave 1 chrome unchanged).
- Props: `title`, `subtitle`, `breadcrumbs`, `status`, `primaryAction`, `secondaryActions`, `context`.
- Responsive: column on xs, row on sm+; actions wrap; no horizontal overflow contract.
- No domain / tournament lifecycle logic.

### AuthConfirmDialog

- Props: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `confirmTone` (`primary`|`destructive`|`success`), `loading`, `disabled`, `onConfirm`, `onCancel`.
- Destructive → MUI `color="error"` (never primary blue).
- Loading blocks backdrop/escape dismiss and disables actions.
- Does **not** mass-replace `window.confirm`.

### State views

- Empty/Loading/Error take domain-supplied copy.
- No hardcoded “Khong co giai dau / CLB” strings.
- Error does not render stack traces / raw backend errors by default.
- Permission/403 page remains separate (`PERMISSION_STATE_VISUAL_ADOPTION=DOCUMENTED_ONLY`).

### AuthResponsiveDataView

- Desktop table + mobile stacked cards via `useMediaQuery`.
- Domain supplies columns/rows/`getRowId`/optional `renderMobileRow`.
- Integrates loading/empty/error slots.
- `DATAGRID_ADOPTED=NO`. Wave 6 page gaps not remediated in 2D.

### AuthFilterBar

- Composition slots only: search, filters, dateControls, reset, secondaryActions, resultCount.
- Domain owns filter values/query. No global filter state manager.

### AppSnackbar

- Tones: info / success / warning / error.
- Visible message text + `aria-live` (polite for non-error, assertive for error).
- Not the notification inbox / CanonicalNotificationButton.

## Freeze locks

```
CANONICAL_TOPBAR_CHANGED=NO
WAVE1_SHELL_CHANGED=NO
TOURNAMENT_23_CHANGED=NO
PUBLIC_WEB_CHANGED=NO
BUSINESS_PAGE_MIGRATION_COUNT=0
DOMAIN_CODE_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
AUTHORIZATION_CHANGED=NO
NOTIFICATION_SYSTEM_CHANGED=NO
WINDOW_CONFIRM_REPO_WIDE_REPLACEMENT=NO
WAVE6_PAGE_GAPS_REMEDIATED_IN_2D=NO
```
