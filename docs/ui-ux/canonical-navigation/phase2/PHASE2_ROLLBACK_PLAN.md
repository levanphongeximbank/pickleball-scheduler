# Phase 2 Rollback Plan

## Primary rollback (instant)

Unset / keep `VITE_CANONICAL_APP_SHELL_ENABLED` **off** (default).

`MainLayout` renders `LegacyMainLayoutContent` only:

- `Sidebar.jsx` + `Header.jsx` + legacy `MobileDrawer`
- Existing `MENU_GROUPS` / `NavMenuShell`
- Slate Enterprise tokens unchanged as default theme palette

No dual shell is rendered.

## Secondary rollback (code)

If the flag path must be removed:

1. Revert `src/layouts/MainLayout.jsx` flag branch
2. Optionally leave `src/features/canonical-shell/` unused (dead code) or delete in a follow-up PR
3. Do **not** delete legacy Sidebar/Header while any environment may need rollback

## What rollback does not require

- Database / SQL changes
- Route deletions
- Production env mutation (flag was never enabled in Production)
- Tournament / Rating authority changes

## Verification after rollback

1. Confirm flag absent or `false`
2. Load app → `data-testid="legacy-app-shell"` present
3. Confirm `data-testid="canonical-app-shell"` absent
4. Smoke: dashboard, sidebar accordion, mobile drawer
