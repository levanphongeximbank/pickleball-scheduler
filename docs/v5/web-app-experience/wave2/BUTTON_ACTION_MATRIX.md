# BUTTON / ACTION MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY  
Do not create a parallel Button library.

```
BUTTON_IMPLEMENTATION_COUNT=11
SHARED_BUTTON_IMPLEMENTATION_COUNT=2
FEATURE_LOCAL_BUTTON_PATTERN_COUNT=9
CANONICAL_BUTTON_CANDIDATE=MUI Button via src/theme/theme.js
```

---

## 1. Implementations

| # | Implementation | File | Scope | Variants | ACTION |
|---|----------------|------|-------|----------|--------|
| 1 | MUI Button + theme overrides | `src/theme/theme.js` | TRULY_GLOBAL / AUTH | contained (green hover glow), radius 10, no shadow, `textTransform: none`, weight 600 | **KEEP_CANONICAL** |
| 2 | MUI IconButton | throughout | AUTH + PUBLIC | size/color ad-hoc | KEEP; add focus-visible in 2C |
| 3 | Experience `primaryActionSx` / `outlinedActionSx` | `tournamentExperienceTokens.js` | FROZEN_VISUAL | primary blue fill / outlined | **FROZEN** |
| 4 | Draw-room button styles | `batchC/drawRoomButtonStyles.js` | TOURNAMENT_SPECIFIC | dark-room CTAs | **FROZEN** |
| 5 | `touchButtonSx` | `src/components/tournament/mobileUi.js` | TOURNAMENT_SHARED | min touch | FEATURE_SPECIFIC_KEEP |
| 6 | CanonicalHelpButton | `CanonicalHelpButton.jsx` | AUTH chrome | icon + focus ring | **FROZEN** |
| 7 | CanonicalNotificationButton | `CanonicalNotificationButton.jsx` | AUTH chrome | icon + badge | **FROZEN** |
| 8 | PlayerImportExportButton | `PlayerImportExport.jsx` | DOMAIN | wrapper | FEATURE_SPECIFIC_KEEP |
| 9 | Showcase Disabled/Outlined/Ceremony buttons | team-tournament showcase | FROZEN_VISUAL | ceremony | **FROZEN** |
| 10 | `publicCtaButtonSx` | `publicPortalStyles.js` | PUBLIC_SHARED | lime CTA, minHeight 44 | PUBLIC_SHARED |
| 11 | `publicGhostButtonSx` | `publicPortalStyles.js` | PUBLIC_SHARED | ghost | PUBLIC_SHARED |

**SHARED_BUTTON_IMPLEMENTATION_COUNT=2** means theme MUI Button + MUI IconButton as the only cross-app primitives. The rest are scoped wrappers.

---

## 2. Variant coverage vs required roles

| Role | Present? | How |
|------|----------|-----|
| PRIMARY | yes | `variant="contained"` — **green** in workspace, **blue** in Experience, **lime** on public |
| SECONDARY | yes | `variant="outlined"` |
| TERTIARY | **gap** | sometimes `text`, inconsistent |
| DESTRUCTIVE | partial | `color="error"` on ClubConfirmDialog confirm; no dedicated style recipe |
| GHOST | public only | `publicGhostButtonSx` |
| ICON | yes | IconButton; labeling uneven |
| LINK_ACTION | partial | MUI `Link` / `Button variant="text"`; no shared link-action |

**BUTTON_VARIANT_GAPS:** TERTIARY recipe, DESTRUCTIVE recipe, LOADING (no `@mui/lab` LoadingButton; pattern is `disabled` + “Đang xử lý…”), GHOST for auth, consistent ICON size (40 vs 44).

---

## 3. Size / height / radius / icon / states

| Concern | Finding |
|---------|---------|
| Size | Mix of default and `size="small"` (theme TextField is small; buttons often default) |
| Height | Public CTA 44; Canonical topbar buttons ~40; many dense tables <40 |
| Radius | Theme 10; Experience control 10; public MUI 2 (8px) |
| Icon placement | Ad-hoc `startIcon`; no shared rule |
| Disabled | MUI default |
| Loading | Label swap only; confirm still `disabled={loading}` |
| Focus | Shell/public have `focus-visible`; **theme.js does not** |
| Destructive confirmations | ClubConfirmDialog is the good path; ~10 `window.confirm` call sites remain |

`window.confirm` files (non-exhaustive): Team/Official/Internal setup, MyClubWeeklySchedule, CoachingEntityPage, UserManagementPage, Tournament.jsx, PrivatePairingRulesAdminView, `main.jsx` PWA refresh.

---

## 4. Adoption (later)

| Field | Value |
|-------|-------|
| NEW_CANONICAL | Theme `MuiButton` variants: `contained`, `outlined`, `text`, `containedError` (or `color=error` recipe), loading via `startIcon={CircularProgress}` helper **or** thin wrapper — Owner pick in 2C |
| EXISTING_COMPONENT_TO_ADAPT | `theme.js` MuiButton + ClubConfirmDialog loading label |
| LEGACY_COMPONENTS | Experience sx (frozen), public CTA (public), showcase (frozen) |
| ADOPTION_APPROACH | Strangler: 2C theme only; 2E pilots use theme variants; no repo-wide Button replace |
| DELETE_WHEN | Never delete MUI Button; deprecate Experience sx only if Experience unfrozen (not this program) |
| ROLLBACK | Revert theme.js component overrides |
