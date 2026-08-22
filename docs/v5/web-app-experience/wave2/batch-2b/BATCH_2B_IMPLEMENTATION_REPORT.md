# Wave 2 Batch 2B — Implementation Report

**BATCH:** 2B — FOUNDATIONS & TOKENS  
**OWNER_GO:** YES  
**PR:** #464  
**PRE_HEAD:** `dfbbc3ada91c9dd895fbd6e6be6fbe96c87b5f7d`

## Scope delivered

| Item | Result |
|------|--------|
| Adapt `designTokens.js` | PASS — semantic COLOR, RADIUS, ELEVATION, INTERACTION, BREAKPOINTS refs |
| Adapt `theme.js` | PASS — primary blue, success green, Inter, focus-visible, radius 12 cards |
| Font loading | PASS — Inter once in `main.jsx`; figure1Fonts meta-only |
| Public isolation | PASS — PublicLayout DM Sans; publicPortalStyles primaryLight pinned |
| Token lock tests | `tests/web-app-wave2-batch2b-foundations-tokens.test.js` |
| Foundation a11y tests | `tests/web-app-wave2-batch2b-foundation-a11y.test.js` |
| Mass color rewrite | NO |
| Second ThemeProvider / token package | NO |
| Second spacing system | NO |
| Wave 1 breakpoints | unchanged (899 / 900 / 1199 / 1200) |
| Figure 1 shell components | unchanged |
| Experience-a1 visual tokens | unchanged |

## Semantic notes

- `SHELL.primaryGreen` remains **SUCCESS** `#10B981` (legacy alias name).
- `SHELL.accentLight` remains mint `#ECFDF5` for legacy KPI/chip consumers.
- `SHELL.primarySurface` / `COLOR.primary.surface` = blue wash for selection.
- `SHELL.sidebarAccent` = workspace primary blue (legacy shell aligns with Figure 1).

## Radius

```
CANONICAL_RADIUS_SCALE=small:8 / medium:10 / large:12 / pill:999
SHAPE.borderRadius → medium (10)
SHAPE.borderRadiusLg → large (12)  // was 16; aligns with Figure 1 card radius
RADIUS_COMPATIBILITY_BREAKS=0
```

## Touch targets

```
CANONICAL_TOUCH_TARGET_MIN=44
FROZEN_SHELL_TOUCH_TARGET_EXCEPTION=CanonicalSidebar item height 40 (Wave 1 freeze; not resized in 2B)
```

## Diff boundary

Primary app files:

- `src/theme/designTokens.js`
- `src/theme/theme.js`
- `src/main.jsx` (font glue)
- `src/features/canonical-shell/fonts/figure1Fonts.js` + `figure1FontMeta.js`
- `src/layouts/public/PublicLayout.jsx` (font isolation only)
- `src/components/public/publicPortalStyles.js` (pin primaryLight; no redesign)
- focused tests + docs

```
DOMAIN_CODE_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
AUTHORIZATION_CHANGED=NO
MASS_REPO_TOKEN_REWRITE=NO
LEGACY_COMPATIBILITY_PRESERVED=YES
```
