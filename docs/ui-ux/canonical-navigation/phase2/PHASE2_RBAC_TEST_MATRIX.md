# Phase 2 RBAC Test Matrix

Authority: Phase 1 `RBAC_MENU_MATRIX.json` + existing `normalizeRole` aliases.

| Role (QA persona) | Canonical runtime | Level-1 access foundation | Private Pairing menu | `/messages` | `/crm/messages` eligible* | V5 skill in menu | Result |
|-------------------|-------------------|---------------------------|----------------------|-------------|---------------------------|------------------|--------|
| SUPER_ADMIN | PLATFORM_ADMIN | 01–13 | Flag-gated only | Hidden | Yes (CRM) | Hidden (direct URL only) | PASS |
| VENUE_OWNER | TENANT_OWNER | 01–10,13 | Hidden | Hidden | Yes | Hidden | PASS |
| VENUE_MANAGER | VENUE_MANAGER | 01–06,08–10,13 | Hidden | Hidden | Yes | Hidden | PASS |
| CASHIER | CASHIER | 01,02,07,13 | Hidden | Hidden | No | Hidden | PASS |
| CLUB_OWNER | CLUB_MANAGER | 01,03–05,13 | Hidden | Hidden | No | Hidden | PASS |
| CLUB_MANAGER | CLUB_MANAGER | 01,03–05,13 | Hidden | Hidden | No | Hidden | PASS |
| COACH | COACH | 04,13 | Hidden | Hidden | No | Hidden | PASS |
| REFEREE | REFEREE | 04,05,08,13 | Hidden | Hidden | No | Hidden | PASS |
| PLAYER | PLAYER | 03–06,13 | Hidden | Hidden | No | Hidden | PASS |
| SYSTEM_TECHNICIAN | SYSTEM_TECHNICIAN | 01,06,12,13 | Hidden | Hidden | No | Hidden | PASS |

\* Eligibility still subject to permission / feature filters; foundation ensures no dual `/messages` entry.

## Automated coverage

File: `tests/canonical-shell-phase2.test.js`

- 10-role Level-1 filtering
- Private Pairing hidden for unauthorized roles
- SUPER_ADMIN Private Pairing remains feature-flag gated
- Permission filtering when RBAC on
- B01/B02/B03 menu invariants

## Existing route guards

Phase 2 does **not** weaken `RouteAccessGate`, `SuperAdminRouteGuard`, or Private Pairing guards. Menu filtering is additive.
