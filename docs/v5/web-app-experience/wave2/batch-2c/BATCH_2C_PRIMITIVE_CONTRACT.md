# BATCH 2C — PRIMITIVE CONTRACT

**WORKSTREAM:** PICK_VN — AUTHENTICATED WEB APP EXPERIENCE  
**WAVE:** WAVE 2 — SHARED DESIGN SYSTEM  
**BATCH:** 2C — CANONICAL SHARED PRIMITIVES  
**OWNER_GO:** YES  
**PR:** #464  
**PRE_HEAD:** `e5c00d11b4c9c689268a4c1b2f95b3af6b7cabeb`

## Objective

Establish Layer 1 authenticated shared primitives on top of MUI + `src/theme` — **without** a parallel component library.

## Location

```
SHARED_PRIMITIVE_LOCATION=src/features/web-app-ui/
OWNERSHIP=AUTHENTICATED_SHARED
```

| File | Role |
|------|------|
| `buttonSemantics.js` | PRIMARY / SECONDARY / TERTIARY / DESTRUCTIVE / SUCCESS → MUI Button props; loading helper |
| `iconButtonA11y.js` | Icon-only accessible-name + touch-target helpers (MUI IconButton base) |
| `StatusToneChip.jsx` | Visual tone chip (label required) |
| `statusToneStyles.js` | Tone → auth token map (node-safe) |
| `FieldError.jsx` | Visible field error + `role="alert"` |
| `fieldFeedback.js` | `aria-invalid` / `aria-describedby` helpers |
| `index.js` | Barrel export |

## Button canonical strategy

```
BUTTON_CANONICAL_STRATEGY=MUI_BUTTON_VIA_THEME_AND_SEMANTICS_HELPER
BUTTON_VARIANTS_IMPLEMENTED=primary,secondary,tertiary/ghost,destructive,success
BUTTON_LOADING_STRATEGY=MUI_BUTTON_NATIVE_LOADING_PROP
NEW_LOADING_BUTTON_DEPENDENCY=NO
PARALLEL_BUTTON_LIBRARY_CREATED=NO
```

| Role | MUI recipe |
|------|------------|
| PRIMARY | `variant="contained" color="primary"` (#3B82F6) |
| SECONDARY | `variant="outlined" color="primary"` |
| TERTIARY / GHOST | `variant="text" color="primary|secondary"` |
| DESTRUCTIVE | `variant="contained" color="error"` (theme `containedError`) |
| SUCCESS | `variant="contained" color="success"` (not generic primary) |

Loading: use installed MUI Button `loading` / `loadingPosition` (v9). No `@mui/lab`.

Touch target 44px for **new shared** surfaces via `sharedTouchTargetSx()` — **not** applied globally (Wave 1 shell + dense tables remain exceptions).

## IconButton

```
ICONBUTTON_BASE=MUI
ICONBUTTON_A11Y_CONTRACT=PASS
```

- Standalone icon-only actions **must** pass a non-empty `label` → `aria-label`.
- Tooltip/title may supplement; must not be the sole accessible name.
- Helper: `iconOnlyButtonProps({ label })`.

## StatusToneChip

```
STATUS_TONE_CHIP_CREATED=YES
STATUS_TONE_CHIP_LOCATION=src/features/web-app-ui/StatusToneChip.jsx
STATUS_ARBITRARY_HEX_API=NO
DOMAIN_STATUS_SEMANTICS_CHANGED=NO
TOURNAMENT_STATUS_COMPONENT_REUSED_DIRECTLY=NO
```

Allowed tones: `neutral | info | success | warning | error | primary` (optional).

Domain maps `PAID` / `ACTIVE` / … → `{ tone, label }`. Chip only renders visual tone + **required label**.

Uses authenticated Slate / Figure 1 semantic colors from `designTokens.js` — not Tournament Experience tokens / Public lime.

## FieldError

```
FIELD_ERROR_CANONICAL_AVAILABLE=YES
FIELD_ERROR_LOCATION=src/features/web-app-ui/FieldError.jsx
FORM_FRAMEWORK_CHANGED=NO
MUI_FORM_PRIMITIVES_REUSED=YES
```

- Visible error copy (`role="alert"`).
- `fieldControlAriaProps` / `fieldErrorId` for control association.
- Theme: FormHelperText error color, FormLabel asterisk, OutlinedInput error/disabled.

## Explicit non-goals (Batch 2D+)

AuthPageHeader, AuthConfirmDialog, Empty/Loading/Error patterns, ResponsiveTable, FilterBar, Snackbar — **not** in 2C.

## Freeze locks

```
FIGURE1_SHELL_CHANGED=NO
WAVE1_SHELL_GEOMETRY_CHANGED=NO
TOURNAMENT_23_CHANGED=NO
PUBLIC_WEB_CHANGED=NO
BUSINESS_PAGE_MIGRATION_COUNT=0
DOMAIN_CODE_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
AUTHORIZATION_CHANGED=NO
```

## Parallel library locks

```
PARALLEL_BUTTON_LIBRARY_CREATED=NO
PARALLEL_FORM_LIBRARY_CREATED=NO
PARALLEL_CARD_LIBRARY_CREATED=NO
NEW_CARD_WRAPPER=NO
```
