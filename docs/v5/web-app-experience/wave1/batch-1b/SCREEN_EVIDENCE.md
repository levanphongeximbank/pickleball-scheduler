# Batch 1B — Screen Evidence

**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED=true`  
**Harness:** `batch1a-shell-evidence.html` (topbar/shell chrome unchanged from 1A)  
**Capture:** `node scripts/capture-wave1-batch1b-menu-evidence.mjs`  
**Machine metrics:** `SCREEN_EVIDENCE.json`

## Results

| Route | Viewport | File | canonical | legacy | topbar |
|-------|----------|------|-----------|--------|--------|
| /dashboard | 1920 | `screenshots/dashboard-1920.png` | 1 | 0 | 1 |
| /tournament | 1920 | `screenshots/tournament-1920.png` | 1 | 0 | 1 |
| /dashboard | 1440 | `screenshots/dashboard-1440.png` | 1 | 0 | 1 |
| /tournament | 1440 | `screenshots/tournament-1440.png` | 1 | 0 | 1 |
| /dashboard | 1024 | `screenshots/dashboard-1024.png` | 1 | 0 | 1 |
| /tournament | 1024 | `screenshots/tournament-1024.png` | 1 | 0 | 1 |
| /dashboard | 430 | `screenshots/dashboard-430.png` | 1 | 0 | 1 |
| /tournament | 430 | `screenshots/tournament-430.png` | 1 | 0 | 1 |

Role-specific leaf inventories (TENANT_OWNER / PLAYER / CASHIER / TEAM_CAPTAIN) are asserted in `tests/web-app-wave1-batch1b-menu-ia.test.js` and `BATCH_1B_AUDIT.md`.
