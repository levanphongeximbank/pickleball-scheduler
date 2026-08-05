# Phase 3 RBAC Test Matrix

Roles covered (10):

| Role | Menu fail-closed unknown | Private Pairing hidden | V5 shadow hidden | B01 legacy `/messages` hidden |
|------|:------------------------:|:----------------------:|:----------------:|:-----------------------------:|
| SUPER_ADMIN | n/a (known) | visible only if feature flag ON | yes | yes |
| VENUE_OWNER | — | yes | yes | yes |
| VENUE_MANAGER | — | yes | yes | yes |
| CASHIER | — | yes | yes | yes |
| CLUB_OWNER | — | yes | yes | yes |
| CLUB_MANAGER | — | yes | yes | yes |
| COACH | — | yes | yes | yes |
| REFEREE | — | yes | yes | yes |
| PLAYER | — | yes | yes | yes |
| SYSTEM_TECHNICIAN | — | yes | yes | yes |
| UNKNOWN_ROLE | **0 leaves** | n/a | n/a | n/a |

## Contracts

- Unknown role → fail closed (zero menu leaves / zero search hits)
- Missing permission context → permission-gated leaves denied when RBAC enabled
- Menu visibility does **not** replace route guards (`RouteAccessGate` remains authoritative)
- Private Pairing remains four-layered (menu layer enforced in `filterCanonicalMenu`)
- No unauthorized menu flash beyond filtered tree (canonical shell builds filtered tree before render)

## Evidence

`tests/canonical-shell-phase3.test.js` — RBAC + Private Pairing + B01/B02/B03 cases.
