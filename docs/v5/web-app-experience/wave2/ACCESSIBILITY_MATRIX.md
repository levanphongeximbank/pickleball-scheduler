# ACCESSIBILITY MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY — shared primitives, not a full WCAG recertification of 186 screens.

Wave 1 already invested a11y in **canonical shell** (`tests/ui/canonical-shell-phase4-a11y.ui.test.jsx`). Wave 2 must not regress that lock, and must extend **workspace** primitives (theme.js currently has **no** a11y component defaults).

```
SHARED_A11Y_CRITICAL_GAPS=3
SHARED_A11Y_MAJOR_GAPS=6
SHARED_A11Y_MINOR_GAPS=3
```

---

## CRITICAL (3)

| ID | Gap | Evidence | 2B–2D implication |
|----|-----|----------|-------------------|
| A11Y-C1 | No global `focus-visible` for Button / IconButton / Dialog | `theme.js` silent; ~14 local `focus-visible` hits (shell + public + a few pages) | Add MUI styleOverrides on **workspace** theme without restyling frozen shell rings |
| A11Y-C2 | Touch targets under 44px on shared nav | Legacy `sidebarNavTokens` `minHeight: 34`; Canonical item `Math.max(40, touchTargetMin - 4)` → **40** vs `FIGURE1_LAYOUT.touchTargetMin=44` | Shell is FROZEN — do not “fix” Canonical item height in Wave 2 without Owner GO. Document; optional later Wave 1 follow-up |
| A11Y-C3 | No shared skip-link / focus policy / error association in theme | Relies on MUI defaults | 2C FieldError + Dialog defaults; skip-link is shell-owned (FROZEN) |

---

## MAJOR (6)

| ID | Gap | Evidence |
|----|-----|----------|
| A11Y-M1 | Form errors not consistently `aria-invalid` / `aria-describedby` | Volume of TextFields vs sparse associations |
| A11Y-M2 | Icon-only actions unlabeled | Many feature `IconButton`s; Canonical Help/Notification **are** labeled |
| A11Y-M3 | Confirm via `window.confirm` | Loses in-page focus trap and VN button labels on ~10 files |
| A11Y-M4 | Custom `role="dialog"` surfaces (showcase, some referee) vs MUI Dialog | Uneven restore |
| A11Y-M5 | Table semantics | Theme restyles head only; few `caption` / `aria-label`; AuditLog ellipsis hides metadata (W6-PAGE-002) |
| A11Y-M6 | Contrast islands | Public lime on navy; muted sidebar `rgba(255,255,255,0.5)`; showcase neon — **scoped**. Workspace Slate text on `#F8FAFC` is generally OK. No contrast tokens for `disabled` |

---

## MINOR (3)

| ID | Gap |
|----|-----|
| A11Y-m1 | `prefers-reduced-motion` in public/showcase/canonical; absent from global theme transitions |
| A11Y-m2 | Dense chips (Experience chip height 24) and table actions <44px — acceptable density if not the only hit target |
| A11Y-m3 | No shared `aria-live` for toasts; TournamentLoadingState already has `aria-live="polite"` |

---

## Positive evidence (do not redo)

- Canonical shell: aria-labels, focus rings, tooltip **and** `aria-label` on collapsed nav.  
- Public filter chips: `aria-pressed` + `focus-visible`.  
- ClubEmptyState / TournamentUiState: `role="status"`.  
- ClubConfirmDialog: loading disables `onClose`.  
- ForbiddenPage: VN 403 copy + recovery links.

---

## Wave 2 test proposal (not added in 2A)

- Unit: token contrast helpers if 2B adds them.  
- Component: FieldError + ConfirmDialog keyboard (Tab, Escape, loading).  
- Keep Wave 1 a11y UI tests green as **foundation lock**.  
- Do not add Storybook in 2A.
