# Wave 5 — Authorization / tenant / flag / operational-gate verification

**Program:** CANONICAL-NAVIGATION-FINAL-PARITY-01  
**Branch:** `fix/canonical-navigation-final-parity-01`  
**Starting HEAD:** `d8c513ae` (Wave 4 re-review PASS)  
**Mode:** Verification-first (no menu/layout/localization changes)  
**Production closure:** NOT claimed

## Verdict

`CANONICAL_NAVIGATION_FINAL_PARITY_01_WAVE5_AUTHORIZATION_VERIFICATION_PASS_READY_FOR_RELEASE_READINESS`

## Scope confirmation

Wave 5 does **not** add menu items, localize UI, or change responsive layout.  
It verifies the expanded 120-node canonical menu remains safe against authorization boundaries.

## Underlying authorization semantics

| File | Changed after `b58829d0`? |
|------|---------------------------|
| `src/auth/rbac.js` | **NO** |
| `src/components/auth/RouteAccessGate.jsx` | **NO** |
| `src/components/TenantGate.jsx` | **NO** |
| `src/features/billing/components/OperationalRouteGate.jsx` | **NO** |
| `src/features/pairing-constraints/guards/superAdminRouteGuard.jsx` | **NO** |

**UNDERLYING_BUSINESS_AUTHORIZATION_SEMANTICS_CHANGED=NO**

Parity work only adjusted menu metadata/filters/labels/topbar layout. Auth business logic is unchanged.

Layout stack (canonical + legacy) remains:

`RouteAccessGate` → `TenantGate` → `OperationalRouteGate` → content

**TENANT_GATE_REMOVED_COUNT=0**

## Primary gates

| Gate | Result |
|------|--------|
| RBAC_PARITY | PASS |
| PERMISSION_PARITY | PASS |
| TENANT_ISOLATION_PARITY | PASS |
| FEATURE_FLAG_PARITY | PASS |
| ROUTE_GUARD_PARITY | PASS |
| OPERATIONAL_GATE_PARITY | PASS |
| PRIVATE_PAIRING_SCOPE_PARITY | PASS |
| UNAUTHORIZED_MENU_EXPOSURE_COUNT | **0** |
| UNAUTHORIZED_ROUTE_ACCESS_REGRESSION_COUNT | **0** |
| TENANT_CROSS_SCOPE_EXPOSURE_REGRESSION_COUNT | **0** |
| FEATURE_FLAG_BYPASS_COUNT | **0** |
| GUARD_BYPASS_COUNT | **0** |
| ROLE_MENU_ROUTE_AUTH_MISMATCH_COUNT | **0** |
| PROMOTED_NODE_WITH_MISSING_EXISTING_OPERATIONAL_GATE | **0** (layout OperationalRouteGate preserved) |
| SUPER_ADMIN_VALID_SAFE_ADMIN_HIDDEN_WITHOUT_JUSTIFICATION | **0** (flags ON) |
| PROMOTED_ROUTE_MATRIX_COMPLETE | **YES** (39 = 13 Wave1 + 26 Wave2) |

## Role Level-1 expectations (`roleLevel1Access`)

| Role | Expected L1 | Platform admin (12) |
|------|-------------|---------------------|
| SUPER_ADMIN | 01–13 | YES |
| VENUE_OWNER | 01–10, 13 (no 11–12) | NO |
| VENUE_MANAGER | 01–06, 08–10, 13 (no 07/11/12) | NO |
| CASHIER | 01, 02, 07, 13 | NO |
| CLUB_OWNER / CLUB_MANAGER | 01, 03–05, 13 | NO |
| COACH | 04, 13 | NO |
| REFEREE | 04, 05, 08, 13 | NO |
| PLAYER | 03–06, 13 | NO |
| SYSTEM_TECHNICIAN | 01, 06, 12, 13 | YES (pre-existing) |

### Per-role summary

| Role | Promoted visibility notes | Denied / constrained |
|------|---------------------------|----------------------|
| SUPER_ADMIN | All 39 promoted hubs when marketplace/API flags ON | B03, Engine contextual, dev/preview hidden |
| VENUE_OWNER | Tenant ops + billing + tournament; no `/admin/*` | Platform admin blocked |
| VENUE_MANAGER | Court/customer/tournament; no L07 billing L1; no `/admin/*` | Platform admin + finance L1 blocked |
| CASHIER | Court ops + billing (+ AUTHENTICATED `/referee` if perms) | No `/admin/*` |
| CLUB_* | Tournament + customer scope; no venue platform admin | No L02 court-mgmt / L07 / L12 |
| COACH | Coaching L04 + support; `/referee` if perms; no tournament L05 hubs | No tournament admin hubs |
| REFEREE | Tournament + referee + messaging L08 | No platform admin |
| PLAYER | Player tournament/customer/skill L03–06; B03 hidden | No `/admin/*` |
| SYSTEM_TECHNICIAN | L12 hubs per pre-existing scope; permission-gated billing needs `billing.*` | Empty-perm L12 hubs are **pre-existing** technician inventory (not lower-role leaks) |

## Feature flags

| Flag | Promoted routes | OFF behavior |
|------|-----------------|--------------|
| `VITE_MARKETPLACE_ENABLED` | `/marketplace` | Hidden for all roles |
| `VITE_API_ENABLED` | `/admin/api-clients`, `/admin/api-logs` | Hidden for all roles |
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | `/admin/ai-pairing/private-rules` | Hidden; SUPER_ADMIN + `SuperAdminRouteGuard` when ON |

**FEATURE_FLAGGED_NODE_VISIBLE_WHEN_FLAG_OFF=0**

## B02 / B03 / private pairing

| Gate | Result |
|------|--------|
| B02_ROUTE_RETENTION | PRESERVED |
| B02_MENU_ALLOWLIST_COUNT | 11 |
| UNAPPROVED_LEGACY_TOURNAMENT_MENU_EXPOSURE | 0 |
| B03_NORMAL_MENU_EXPOSURE | NO |
| B03_SHADOW_RULE_PRESERVED | YES |
| B03_ROLE_SCOPE_BROADENED | NO |
| PRIVATE_PAIRING_REQUIRED_ROLES_PRESERVED | YES (`SUPER_ADMIN`, `PLATFORM_ADMIN`) |
| PRIVATE_PAIRING_REQUIRED_FLAGS_PRESERVED | YES |
| PRIVATE_PAIRING_PERMISSION_SCOPE_BROADENED | NO |

## SYSTEM_TECHNICIAN empty-permission L12 note

Several Wave 2 L12 hubs (`/admin/marketplace*`, integration logs/transactions/webhooks) have **empty** `requiredPermissions` and empty `ROUTE_ACCESS_PERMISSIONS`.  

Menu visibility for `SYSTEM_TECHNICIAN` follows pre-existing `roleLevel1Access["12"]`. Lower roles **cannot** see these hubs (L1-12 denied).  

Wave 5 treats this as **preserved pre-existing technician scope**, not a new lower-role authorization bypass. No underlying auth files were changed to broaden access.

## Promoted route matrix (39)

Columns: route · L1 · menu roles (* perms / flags ON) · required perms · flags · node guards · route perms · layout TenantGate · layout OperationalRouteGate · result

| Route | L1 | Menu roles (* / flags ON) | Perms | Flags | Node guards | Route perms | TG | OG | Result |
|-------|----|---------------------------|-------|-------|-------------|-------------|----|----|--------|
| `/tournament` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate | tournament.view | Y | Y | PASS |
| `/tournament/list` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate | tournament.view | Y | Y | PASS |
| `/tournament/create` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.create | — | RouteAccessGate | tournament.create | Y | Y | PASS |
| `/tournament/types` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate + player-blocked | tournament.view | Y | Y | PASS |
| `/tournament/roster` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate | tournament.view | Y | Y | PASS |
| `/tournament/register` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate | tournament.update\|view | Y | Y | PASS |
| `/tournament/organize` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate | tournament.view | Y | Y | PASS |
| `/tournament/operations` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate + player-blocked | tournament.view | Y | Y | PASS |
| `/tournament/results` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate | tournament.view | Y | Y | PASS |
| `/tournament/config` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate + player-blocked | tournament.view | Y | Y | PASS |
| `/tournament/my` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate | tournament.view | Y | Y | PASS |
| `/daily-play` | 05 | SA,VO,VM,CO,CM,REF,PL | tournament.view | — | RouteAccessGate + player-blocked | tournament.view | Y | Y | PASS |
| `/referee` | 05 | AUTHENTICATED + perms | tournament.view\|match.update | — | auth-only | tournament.view\|match.update | Y | Y | PASS |
| `/court-management/ops-log` | 02 | SA,VO,VM,CA | court.view | — | RouteAccessGate | court.view\|booking.view | Y | Y | PASS |
| `/court-management/future` | 02 | SA,VO,VM,CA | court.update\|venue.update | — | RouteAccessGate | court/venue update\|view | Y | Y | PASS |
| `/mobile/qr-generate` | 02 | SA,VO,VM,CA | tournament.update | — | MobileRouteGate | tournament.update | Y | Y | PASS |
| `/court-management/customer-groups` | 03 | SA,VO,VM,CO,CM,PL | court.view | — | RouteAccessGate | court.view\|booking.view | Y | Y | PASS |
| `/billing` | 07 | SA,VO,CA | billing.view | — | RouteAccessGate | billing.view | Y | Y | PASS |
| `/billing/invoices` | 07 | SA,VO,CA | billing.invoice.view | — | RouteAccessGate | billing.invoice.view | Y | Y | PASS |
| `/billing/usage` | 07 | SA,VO,CA | billing.view | — | RouteAccessGate | billing.view | Y | Y | PASS |
| `/marketplace` | 07 | SA,VO,CA | marketplace.view | VITE_MARKETPLACE_ENABLED | RouteAccessGate | marketplace.view | Y | Y | PASS |
| `/admin/billing` (+ tenants/plans/invoices/payments/audit) | 12 | SA,ST | billing.* | — | RouteAccessGate | billing.* | Y | Y | PASS |
| `/admin/marketplace` (+ products/orders) | 12 | SA,ST | (empty) | — | RouteAccessGate | (empty) | Y | Y | PASS |
| `/admin/integration-logs` / payment-transactions / webhook-events | 12 | SA,ST | (empty) | — | RouteAccessGate | (empty) | Y | Y | PASS |
| `/admin/api-clients` / `/admin/api-logs` | 12 | SA,ST | (empty) | VITE_API_ENABLED | RouteAccessGate | (empty) | Y | Y | PASS |
| `/settings/integrations/payments` / zalo-oa | 12 | SA,ST | integration.manage | — | RouteAccessGate | integration.manage | Y | Y | PASS |
| `/support/faq` / `/support/guide` | 13 | all QA roles | (empty) | — | RouteAccessGate | (empty) | Y | Y | PASS |

Role key: SA=SUPER_ADMIN, VO=VENUE_OWNER, VM=VENUE_MANAGER, CA=CASHIER, CO=CLUB_OWNER, CM=CLUB_MANAGER, REF=REFEREE, PL=PLAYER, ST=SYSTEM_TECHNICIAN.

## Wave 1–4 preservation

| Metric | Value |
|--------|------:|
| Proposed nodes | 120 |
| Active menu | 102 |
| Wave1 tournament targets | 13 |
| B02 allowlist | 11 |
| B03 sidebar | hidden |
| Labels VN | 379 / 379 |
| Topbar observation | LOCALLY_VERIFIED_CLOSED_PENDING_PRODUCTION_ACCEPTANCE |
| Topbar 768 class | mobile |

## Tests

`tests/canonical-navigation-final-parity-wave5.test.js` plus Wave1–4 + canonical-shell phase3.

## Safety

Production / Vercel / SQL / auth mutation / push / PR: **NO**
