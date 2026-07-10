# Phase 42J.1 — Rollback

## App
Revert commits for `clubLandingResolver.js`, guards, `menuAccess.js`, `MyClubPage.jsx`, `clubCoachingMenu.js`.

## Staging SQL
Rollback `phase_42j1_apply_42i1_hotfix` only if replacing with full `PHASE_42I1_ROLLBACK.sql` (not recommended if production already on 42I.1).

## Vercel Preview
Remove `VITE_CLUB_STORAGE_V2` from Preview env if needed.

## QA seed
Restore `admin@staging.local` membership if removed for QA.
