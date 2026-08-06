# Phase 5 Preview Acceptance Route Matrix

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Preview flag-ON acceptance matrix (plan; not executed in this audit)  
**Flag target:** `VITE_CANONICAL_APP_SHELL_ENABLED=true` on Preview only  
**Shell:** Canonical exclusive (no dual shell)  
**Registry invariants:** 179/179 · menu 76 · contextual 7 · duplicates 0

Machine-readable: [`PHASE5_PREVIEW_ROUTE_MATRIX.json`](./PHASE5_PREVIEW_ROUTE_MATRIX.json)

Legend for common columns:

| Column | Meaning |
|--------|---------|
| Status | Expected HTTP/UI outcome |
| Component | Primary page/component |
| Desktop/Mobile menu | Visible in canonical menus when entitled |
| Search | Visible in canonical global search index |
| Direct / Refresh / BF | Direct-link, reload, back/forward behavior |
| Rollback | Expectation when Preview flag returns OFF |

---

## A. Public

| ID | Route | Expected status | Component/page | Role | Permission | Tenant | Desktop menu | Mobile menu | Search | Direct | Refresh | Back/Forward | Rollback (flag OFF) |
|----|-------|-----------------|----------------|------|------------|--------|--------------|-------------|--------|--------|---------|--------------|---------------------|
| P-01 | `/` | 200 public/home | Public/home entry | none | public | n/a | portal | portal | per registry | OK | OK | OK | Same public; legacy shell if authed later |
| P-02 | `/home` | 200 | Home | none/auth | public/home | n/a | yes if entitled | yes | yes | OK | OK | OK | Legacy shell when authed |
| P-03 | `/clubs` | 200 | Clubs public/list | none | public | n/a | portal | portal | yes | OK | OK | OK | Unchanged route |
| P-04 | `/courts` | 200 | Courts public/list | none | public | n/a | portal | portal | yes | OK | OK | OK | Unchanged |
| P-05 | `/tournaments` | 200 public catalog | Tournament catalog | none | public | n/a | yes | yes | yes | OK | OK | OK | Unchanged; still public |
| P-06 | `/tournaments/` | 200 public catalog | Tournament catalog | none | public | n/a | alias | alias | alias | OK | OK | OK | Unchanged |

---

## B. Messaging (OD-B01 KEEP_SEPARATE)

| ID | Route | Expected status | Component | Role | Permission | Tenant | Desktop | Mobile | Search | Direct | Refresh | BF | Rollback |
|----|-------|-----------------|-----------|------|------------|--------|---------|--------|--------|--------|---------|----|----------|
| M-01 | `/messages` | 200 if entitled else login/403 | `MessagingExperiencePage` | COMMS entitled | per COMMS map (not CRM) | n/a | **yes** (dual-canonical) | yes | yes distinct label | Serves Messaging Experience | Persist | No cross-redirect | Still mounted; may appear in legacy messaging menu |
| M-02 | `/crm/messages` | 200 if `booking.view\|customer.view` else 403 | `CrmMessagesPage` | CRM roles | booking.view \| customer.view | venue scope | **yes** | yes | yes distinct | Serves CRM outreach | Persist | No redirect to `/messages` | Still mounted |

**Invariant:** redirects either direction = **0**. Duplicate active entries = **0**.

---

## C. Tournament Engine (7 protected + denial cases)

Canonical tabs (contextual — **not** in general menu/search):

1. `/tournaments/:tournamentId/engine`  
2. `.../seed`  
3. `.../draw`  
4. `.../schedule`  
5. `.../courts`  
6. `.../ranking`  
7. `.../logs`  

Component: `TournamentEnginePage` · Gate: `decideTournamentEngineRouteGate` · Required: authenticated + `tournament.update` + ownership/tenant · Independent of `VITE_RBAC_ENABLED` when auth active.

| ID | Case | Route example | Expected status | Role | Permission | Tenant/ownership | Menu D/M | Search | Direct | Refresh | BF | Rollback |
|----|------|---------------|-----------------|------|------------|------------------|----------|--------|--------|---------|----|----------|
| E-01 | Authorized | `/tournaments/{ownedId}/engine` | 200 Engine | VENUE_OWNER / SUPER_ADMIN / entitled | tournament.update | same tenant owner | contextual only | no general | OK | OK | OK tab state | Engine still protected under legacy shell |
| E-02 | Permission denied | `/tournaments/{id}/engine` | 403 | PLAYER / REFEREE | lacks tournament.update | any | hidden | no | Deny | Deny persists | Deny | Same |
| E-03 | Ownership/tenant denied | `/tournaments/{otherTenantId}/engine` | 403 | VENUE_OWNER A | has perm | **mismatch** | hidden | no | Deny | Deny | Deny | Same |
| E-04 | Unauthenticated | `/tournaments/{id}/seed` | redirect login | none | — | — | n/a | n/a | Login | Login | Login | Same |
| E-05 | Tab seed | `.../seed` | same gate as engine | entitled | tournament.update | match | contextual | no | OK/deny | OK/deny | OK | Same |
| E-06 | Tab draw | `.../draw` | same gate | entitled | tournament.update | match | contextual | no | OK/deny | OK/deny | OK | Same |
| E-07 | Tab schedule | `.../schedule` | same gate | entitled | tournament.update | match | contextual | no | OK/deny | OK/deny | OK | Same |
| E-08 | Tab courts | `.../courts` | same gate | entitled | tournament.update | match | contextual | no | OK/deny | OK/deny | OK | Same |
| E-09 | Tab ranking | `.../ranking` | same gate | entitled | tournament.update | match | contextual | no | OK/deny | OK/deny | OK | Same |
| E-10 | Tab logs | `.../logs` | same gate | entitled | tournament.update | match | contextual | no | OK/deny | OK/deny | OK | Same |
| E-11 | Catalog vs nested | `/tournaments` vs nested | catalog public; nested protected | — | — | — | catalog yes | catalog yes | Distinct | Distinct | Distinct | Distinct |

**B02:** Legacy `/tournament/*` remain mounted (retain); flag ON menus must **not** list them as second authority.

---

## D. Rating V5 shadow (`/player/skill-assessment-v5`) — OD-B03

Component: `SkillAssessmentV5Page` + `SkillAssessmentV5RouteGuard`  
Menu/search: **always hidden**

| ID | Case | V5 flag | Expected status | Role | Notes | Desktop/Mobile/Search | Direct | Refresh | BF | Rollback |
|----|------|---------|-----------------|------|-------|------------------------|--------|---------|----|----------|
| R-01 | SUPER_ADMIN flag OFF | OFF | **Allow** tech-eval | SUPER_ADMIN | OD-B03 | hidden | OK | OK | OK | Guard remains; legacy may expose differently — assert hide |
| R-02 | SUPER_ADMIN flag ON | ON | **Allow** | SUPER_ADMIN | | hidden | OK | OK | OK | Same |
| R-03 | PLATFORM_ADMIN | OFF or ON | **Allow** | PLATFORM_ADMIN | Identity **MISSING** — Owner waive/provision | hidden | OK | OK | OK | Same |
| R-04 | PLAYER enrolled | ON | **Allow** | PLAYER | enrollment valid | hidden | OK | OK | OK | Same |
| R-05 | PLAYER not enrolled | ON | Deny / unavailable | PLAYER | | hidden | Deny | Deny | Deny | Same |
| R-06 | Unrelated role | any | **403** | e.g. VENUE_MANAGER / COACH | COACH identity missing | hidden | Deny | Deny | Deny | Same |
| R-07 | Unauthenticated | any | Deny → login | none | | n/a | Login | Login | Login | Same |

---

## E. Private Pairing

Route: `/admin/ai-pairing/private-rules`  
Visibility: `isPrivatePairingVisible` — SUPER_ADMIN (+ global) when pairing flag ON

| ID | Case | Expected status | Role | Permission/flag | Tenant | Menu D/M | Search | Direct | Refresh | BF | Rollback |
|----|------|-----------------|------|-----------------|--------|----------|--------|--------|---------|----|----------|
| PP-01 | Authorized SUPER_ADMIN | 200 | SUPER_ADMIN | pairing rules flag ON | global | desktop yes / mobile per registry | yes if entitled | OK | OK | OK | Hidden under flag OFF pairing or non-admin |
| PP-02 | Unauthorized role | 403 / hidden | VENUE_OWNER etc. | — | any | hidden | no | Deny | Deny | Deny | Same |
| PP-03 | Tenant mismatch | N/A or deny | non-global | — | where applicable | hidden | no | Deny | Deny | Deny | Global-only feature |

---

## F. Shell / navigation invariants (all Preview sessions)

| ID | Check | Flag ON expect | Flag OFF expect |
|----|-------|----------------|-----------------|
| S-01 | Exclusive shell | Canonical only | Legacy only |
| S-02 | Dual shell | **0** | **0** |
| S-03 | Menu count | **76** | Legacy menu (not 76 contract) |
| S-04 | Contextual | **7** | Engine still routable via direct links |
| S-05 | Duplicates | **0** | N/A canonical contract |
| S-06 | Registry | **179/179** | Same catalog |
| S-07 | Inter CSS | Loaded with canonical mount | **Not** loaded |
| S-08 | Console errors | **0** | **0** |

---

## Counts

| Class | Rows |
|-------|-----:|
| Public | 6 |
| Messaging | 2 |
| Engine | 11 |
| Rating V5 | 7 |
| Private Pairing | 3 |
| Shell invariants | 8 |
| **Total acceptance rows** | **37** |
