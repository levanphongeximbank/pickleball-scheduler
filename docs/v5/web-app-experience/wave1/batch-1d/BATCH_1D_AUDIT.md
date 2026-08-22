# Wave 1 Batch 1D — Tablet / Mobile Shell Convergence

**PRE_HEAD:** `7c89bad2a791ed87d16901b0373c8208f45659c2`  
**Branch:** `feat/web-app-wave1-shell-navigation-01`  
**PR:** #463  

## Breakpoints

| Band | FIGURE1 | MUI |
|---|---|---|
| mobile | ≤899 | `down("md")` |
| tablet | 900–1199 | `between("md","lg")` |
| desktop | ≥1200 | neither |

`CURRENT_BREAKPOINT_SYSTEM=FIGURE1_BREAKPOINTS + MUI md/lg`  
`BREAKPOINT_CONFLICT_FOUND=NO`

## Behavior

- **Desktop:** default sidebar 260px expanded; collapse toggle reused (session override only).
- **Tablet:** default 64px rail; expand/collapse via existing control.
- **Mobile:** no persistent sidebar; `CanonicalMobileDrawer` + `MobileBottomNav`.
- **Mobile topbar:** menu + compact title + compact search + notification/help/account.
- **Selectors:** Tenant/Venue/Club relocated into drawer context on mobile (same components, no duplicate state).

## Persistence

`SIDEBAR_PERSISTENCE_REUSED=NO` (none existed) · `NEW_PERSISTENCE_KEY_CREATED=NO` (session override only)

## Bottom nav

CASHIER excluded from check-in tab (Batch 1B chrome alignment). No null paths in profiles.
