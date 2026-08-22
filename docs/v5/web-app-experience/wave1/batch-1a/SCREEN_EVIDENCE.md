# Batch 1A — Screen Evidence

**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED=true`  
**Harness:** `batch1a-shell-evidence.html` + `scripts/wave1-batch1a-evidence-entry.jsx`  
**Machine metrics:** `SCREEN_EVIDENCE.json`

## Capture method

Local Vite + Playwright. MainLayout harness (not full `router.jsx`) so chrome exclusivity can be proven without unrelated client-bundle crashes (`node:crypto` dry-run module via full App).

Page bodies are labeled stand-ins in the MainLayout content slot for `/dashboard` and `/tournament` — proving **one** Canonical sidebar + **one** Canonical topbar around real shell chrome. Tournament Experience internals are not restyled (Batch 1A outer shell only).

## Results

| Route | Viewport | File | canonical | legacy | topbar | drawers |
|-------|----------|------|-----------|--------|--------|---------|
| /dashboard | 1920 | `screenshots/dashboard-1920.png` | 1 | 0 | 1 | 1 |
| /tournament | 1920 | `screenshots/tournament-1920.png` | 1 | 0 | 1 | 1 |
| /dashboard | 1440 | `screenshots/dashboard-1440.png` | 1 | 0 | 1 | 1 |
| /tournament | 1440 | `screenshots/tournament-1440.png` | 1 | 0 | 1 | 1 |

```
SIMULTANEOUS_APP_SHELL_RENDER=NO
ONE_SIDEBAR=YES
ONE_TOPBAR=YES
NO_MOBILE_BOTTOM_NAV_AT_DESKTOP=YES
```

## Re-run

```bash
node scripts/capture-wave1-batch1a-shell-evidence.mjs
```
