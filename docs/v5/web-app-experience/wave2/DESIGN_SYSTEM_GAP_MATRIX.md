# DESIGN SYSTEM GAP MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY  
Actions: `KEEP_CANONICAL` | `ADAPT_CANONICAL` | `CONSOLIDATE_LATER` | `FEATURE_SPECIFIC_KEEP` | `FROZEN` | `DEPRECATE_AFTER_ADOPTION`

```
REUSE_BEFORE_REBUILD=YES
```

---

## KEEP_CANONICAL

| Item | Why |
|------|-----|
| `src/theme/theme.js` as the only **app** ThemeProvider | Already wired in `main.jsx` |
| `src/theme/designTokens.js` as workspace token SSoT | Claimed SSoT; real consumers |
| MUI Button / Card / Paper / Table / TextField | Universal primitives |
| ForbiddenPage | Global 403 |
| Wave 1 shell + breakpoints | Closed wave |
| `@mui/icons-material` | Only icon library |

---

## ADAPT_CANONICAL (Wave 2B–2D)

| Item | Gap | Adapt how |
|------|-----|-----------|
| designTokens semantic map | Missing info, surface-elevated, focus, disabled, live | Extend **same file** |
| theme.js hardcoded table greys | `#F8FAFC` / `#FAFBFC` not tokens | Point at PALETTE |
| theme.js MuiButton | No destructive/loading/focus-visible | Component overrides |
| MuiCard radius 16 vs Figure 1 12 | Nested theme override | Owner GO: put 12 on base theme |
| ClubPageShell | Club-only | Extract AuthPageHeader API |
| ClubConfirmDialog | Club-only | Extract AuthConfirmDialog |
| ClubEmptyState + TournamentUiState | Duplicate families | Shared AuthEmpty/Loading/Error |
| ExperienceStatusChip tones | Frozen component | New StatusToneChip + Slate colors |
| ResponsiveDataView | Lives under mobile | Shared table wrapper |
| InterventionFeedbackSnackbar | Pairing-only | AppSnackbar |
| LAYOUT gutters | No mobile 16 in Slate LAYOUT | Add `contentPaddingMobile` |

---

## CONSOLIDATE_LATER (Waves 3–5, pilots in 2E)

| Item | Notes |
|------|-------|
| Dashboard local StatCard vs KpiCard | One metric card |
| Players using TournamentPageHeader / TournamentEmptyState | Leak |
| 8 empty-state families | After AuthEmpty exists |
| 16 status chips | Visual tone only; keep domain wrappers |
| GlobalSearch vs CanonicalGlobalSearch | Shell already Canonical |
| window.confirm vs ConfirmDialog | Per touched page |
| Admin/finance/CRM raw tables | After wrapper exists |
| Alert used as loading **and** error | Split patterns |

---

## FEATURE_SPECIFIC_KEEP

Court calendar tokens, club entity cards, finance/CRM/billing Unavailable views, tournament list/standings/match cards, custom form controls (level select, avatar picker, captain toggle), PlayerImportExportButton, ModeCard.

---

## FROZEN

| Item | Reason |
|------|--------|
| CanonicalAppShell family + figure1Tokens + nested shell theme | Wave 1 |
| Experience 23 visual system including ExperiencePageHeader | Owner freeze |
| Public navy + lime | Parallel workstream |
| Showcase / animation / referee V5 / draw-room dark UI | Do not globalize because they look polished |
| TYPE_BANNER gradients | Tournament-specific |

---

## DEPRECATE_AFTER_ADOPTION (do not delete in 2A)

| Item | When |
|------|------|
| `src/index.css` Vite purple scaffold | After confirmed zero import |
| `@mui/x-data-grid` unused dependency | After Owner GO that MUI Table is the strategy |
| Plus Jakarta as auth font | Never load for auth; showcase may load later if unfrozen |
| `GlobalSearch.jsx` | After legacy shell retired |
| Dashboard StatCard | After KpiCard-only |

---

## Explicit non-gaps (do not “fix”)

- Do not replace Figure 1 blue shell accent with Slate green.  
- Do not replace Slate workspace primary with Tournament `#2563EB` without Owner GO.  
- Do not restyle public homepage to match admin Cards.  
- Do not change 899/900/1199/1200.

---

## Owner GO before 2B

1. Workspace primary: **keep `#10B981`** vs **align buttons to Figure 1 `#3B82F6`**.  
2. Card radius on **base** theme: keep 16 vs **12** to match shell.  
3. Font: keep **DM Sans body + Inter shell** vs unify.
