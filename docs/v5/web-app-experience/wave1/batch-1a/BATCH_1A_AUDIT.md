# Wave 1 Batch 1A — Exclusive Canonical Chrome Lock

**Worktree:** `web-app-wave1-shell-navigation-01`  
**Branch:** `feat/web-app-wave1-shell-navigation-01`  
**Batch:** 1A  
**Mode:** OWNER_GO=YES  
**Date:** 2026-08-22

## Objective

Prove authenticated Web App routes use exactly one application chrome:

| Flag | Chrome |
|------|--------|
| `VITE_CANONICAL_APP_SHELL_ENABLED=true` | `CanonicalAppShell` only |
| `VITE_CANONICAL_APP_SHELL_ENABLED=false` / unset | `LegacyMainLayoutContent` only |

`SIMULTANEOUS_APP_SHELL_RENDER=NO`

## Architecture lock (unchanged)

```
CANONICAL_APP_SHELL=CanonicalAppShell
CANONICAL_APP_SHELL_ONLY=YES
LEGACY_APP_SHELL=LegacyMainLayoutContent
LEGACY_APP_SHELL_ROLE=ROLLBACK_ONLY
DELETE_LEGACY_SHELL_IN_WAVE1=NO
DO_NOT_BUILD_NEW_APP_SHELL=YES
NEW_SHELL_FLAG=NO
ROLLBACK_PATH_PRESERVED=YES
```

## Route boundary audit

### Intentional outside MainLayout

- Auth: `/login`, `/forgot-password`, `/reset-password`, `/change-password`
- Access: `/403`
- Coming soon placeholder: `/coming-soon/:moduleKey` *(chrome-less; see bypass note)*
- Referee token: `/referee/:token`
- Public Experience: `/tournament/:tournamentId/public`
- Public catalog: `/`, `/home`, `/public/tournaments`, `/clubs`, `/courts`, `/rankings`, `/news`, …
- Redirect: `/onboarding/pick-vn-rating` → skill assessment

### Authenticated business routes

All normal authenticated business routes nest under `<Route element={<MainLayout />}>` in `src/router.jsx` (dashboard, tournament hubs/experience, settings, billing, court-management, mobile ops, etc.).

### Bypass inventory (report-only — no architecture relocate in 1A)

```
AUTHENTICATED_MAINLAYOUT_BYPASS_COUNT=1
AUTHENTICATED_MAINLAYOUT_BYPASS_ROUTES=/coming-soon/:moduleKey
```

`MASTER_ROUTE_INVENTORY` lists Coming Soon as AUTH with Layout=MainLayout, but the live router mounts it **outside** MainLayout as a chrome-less placeholder. Batch 1A does **not** move it (Owner architecture stop for IA). Flag for Batch 1B+ Owner decision if chrome should wrap it.

## MainLayout exclusivity

```
CANONICAL_FLAG_ON_CANONICAL_SHELL_COUNT=1
CANONICAL_FLAG_ON_LEGACY_SHELL_COUNT=0
CANONICAL_FLAG_OFF_CANONICAL_SHELL_COUNT=0
CANONICAL_FLAG_OFF_LEGACY_SHELL_COUNT=1
SIMULTANEOUS_APP_SHELL_RENDER=NO
```

Source: `src/layouts/MainLayout.jsx` — XOR branch in `MainLayoutContent`.

## Frozen / deferred (Batch 1A)

| Gate | Value |
|------|-------|
| TOURNAMENT_23_VISUAL_RUNTIME_CHANGED | NO |
| MENU_IA_CHANGED | NO |
| TOPBAR_CHANGED | NO |
| TABLET_BEHAVIOR_CHANGED | NO |
| MOBILE_NAV_CHANGED | NO |
| DOMAIN_CODE_CHANGED | NO |
| AUTHORIZATION_CHANGED | NO |

Owner strangler sidebar list for Batch **1B only** (not implemented here):

`/tournament`, `/tournament/list`, `/tournament/types`, `/tournament/roster`, `/tournament/organize`, `/tournament/operations`, `/tournament/results`, `/tournament/config`

Help target `/support` recorded for Batch **1C** (not implemented here).

## Tests

- `tests/web-app-wave1-batch1a-shell-exclusivity.test.js`
- `tests/ui/web-app-wave1-batch1a-shell-exclusivity.ui.test.jsx`

Coverage: flag ON/OFF exclusivity, no double topbar, mobile chrome exclusivity, public/referee outside shell, Wave 0 organizer auth module intact.

## Screen evidence

Root: `docs/v5/web-app-experience/wave1/batch-1a/`

Capture script: `scripts/capture-wave1-batch1a-shell-evidence.mjs`  
Flag ON local Vite — viewports 1920 / 1440 — routes `/dashboard`, `/tournament`.

## Diff boundary

Touched app sources (only):

- `src/layouts/MainLayout.jsx` (exclusivity comments)
- `src/features/canonical-shell/flags.js` (rollback docs)

Plus focused tests + audit/evidence.
