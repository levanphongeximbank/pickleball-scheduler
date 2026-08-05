# Phase 3 Rollback Plan

## Immediate rollback (no deploy required)

1. Keep / set `VITE_CANONICAL_APP_SHELL_ENABLED` unset or `false` (default).
2. App renders **legacy shell only** via `MainLayout` → `LegacyMainLayoutContent`.
3. Canonical shell code remains inert (no dual navigation).

## If Preview was enabled with flag ON

1. Remove Preview env override for `VITE_CANONICAL_APP_SHELL_ENABLED`.
2. Redeploy Preview **or** wait for next Preview build with default OFF.
3. Verify `data-testid="legacy-app-shell"` mounts; `canonical-app-shell` absent.

## What does not need rollback

- Route runtime / Tournament / Rating authority (unchanged in Phase 3)
- Database / SQL (none executed)
- Production feature flags (unchanged)

## Package note

Phase 3 adds `@fontsource/inter`. Harmless when flag OFF (CSS imported only by canonical shell mount). Optional follow-up: leave dependency installed.

## Authority

Legacy shell remains rollback authority until a later Owner enablement decision.
