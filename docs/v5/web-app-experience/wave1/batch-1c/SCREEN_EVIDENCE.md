# Batch 1C — Screen Evidence

**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED=true`  
**Harness:** `batch1c-topbar-evidence.html`  
**Capture:** `node scripts/capture-wave1-batch1c-topbar-evidence.mjs`

## Routes × viewports

`/dashboard`, `/tournament`, `/tournament/:safeId/overview` × 1920 / 1440 / 1024 / 430

430 = observation only for Batch 1D.

## Checks

- Exclusive Canonical shell
- Help present (desktop/tablet) with `data-help-target=/support`
- Topbar not clipped at 1920/1440
