# Wave 1 Batch 1E — Final Visual Evidence

**Captured:** see `FINAL_VISUAL_EVIDENCE.json`  
**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED=true`  
**Harness:** `batch1c-topbar-evidence.html` (no page redesign)

## Required closure shots

| Shot | File |
|---|---|
| Desktop 1440 `/dashboard` | `screenshots/dashboard-1440.png` |
| Desktop 1440 `/tournament` | `screenshots/tournament-1440.png` |
| Tablet 1024 `/dashboard` | `screenshots/dashboard-1024.png` |
| Tablet 1024 `/tournament` | `screenshots/tournament-1024.png` |
| Mobile 430 `/dashboard` drawer closed | `screenshots/dashboard-430-closed.png` |
| Mobile 430 `/dashboard` drawer open | `screenshots/dashboard-430-drawer-open.png` |
| Mobile 430 `/tournament` | `screenshots/tournament-430.png` |

## Batch 1D breakpoint evidence (retained)

Boundary and representative captures remain under:

`docs/v5/web-app-experience/wave1/batch-1d/screenshots/`

Referenced copies in this folder (`retained-1d-*`):

- 1199 / 900 / 899 (exact tablet/mobile boundaries)
- 1920 / 768 / 390 / 360
- `retained-1d-dashboard-1200.png` is a **desktop-band reference** copied from Batch 1D `dashboard-1440.png` (no separate 1200px PNG existed). Exact `1200` / `1199` / `900` / `899` shell contracts are certified by Batch 1D targeted tests + Batch 1D SCREEN_EVIDENCE for adjacent widths.

## Capture metrics (closure set)

All 7 required shots: `canonical=1`, `legacy=0`, `topbars=1`, `shellOverflow=false`.  
Mobile shots: no persistent sidebar; drawer-open shot shows drawer panel.

## Do not redesign

Evidence only — no visual redesign for Batch 1E.
