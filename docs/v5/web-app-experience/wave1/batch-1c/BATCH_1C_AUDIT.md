# Wave 1 Batch 1C — Topbar / Selectors / Account / Help

**PRE_HEAD:** `bf1f908cc5a2582b050532deb9abeb1ae30acb74`  
**Branch:** `feat/web-app-wave1-shell-navigation-01`  
**PR:** #463  

## Changes

- Added `CanonicalHelpButton` → `/support` (gated by `canAccessRoute` when RBAC on).
- Wired into `CanonicalTopBar` actions: notification → help → account.
- Reused existing Tenant/Venue/Club/Search/Notification/AccountMenu — no new systems.

## Help / support auth audit

| Role | `/support` canAccessRoute (RBAC on) |
|---|---|
| PLATFORM_ADMIN | ALLOW |
| TENANT_OWNER | ALLOW |
| VENUE_MANAGER | ALLOW |
| CLUB_MANAGER | ALLOW |
| PLAYER | ALLOW |
| CASHIER | ALLOW |
| REFEREE | ALLOW |

`HELP_TARGET=/support` · `HELP_ROUTE_ACCESS=PASS` · `SUPPORT_AUTH_GAP_FOUND=NO`

## Expected 1D gaps

- Tablet 1024: tenant+venue+club+search+actions may crowd; no ad-hoc collapse in 1C.
- Mobile ≤899: Help may still render in actions; Batch 1D owns mobile header relocation / drawer composition.

## Freeze

`TOURNAMENT_23_INTERNAL_UI_CHANGED=NO` · `SIDEBAR_1B` untouched · Batch 1A exclusivity untouched
