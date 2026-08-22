# ROLE_UX_MATRIX

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY  
**Sources:** `ROLE_MENU_MAP` (`navigationConfig.js`), `filterCanonicalMenu.js` `roleLevel1Access`, `RouteAccessGate` + `canAccessRoute` / `ROUTE_PERMISSIONS`, `PLAYER_RESTRICTED_ROUTE_PREFIXES`.

Runtime role names (canonical): `PLATFORM_ADMIN`, `SYSTEM_TECHNICIAN`, `TENANT_OWNER`, `VENUE_MANAGER`, `TOURNAMENT_MANAGER`, `TEAM_CAPTAIN`, `CASHIER`, `CLUB_MANAGER`, `COACH`, `REFEREE`, `STAFF`, `PLAYER`, `CUSTOMER`, `SUPPORT`.  
Aliases: `SUPER_ADMIN→PLATFORM_ADMIN`, `VENUE_OWNER→TENANT_OWNER`, `CLUB_OWNER→CLUB_MANAGER`.

RBAC: ON by default in production builds (`isRbacEnabledFromEnv`).

---

## ROLE_MENU_MATRIX (V5 sidebar groups)

Y = group visible. `messaging` is **N for all except PLATFORM_ADMIN/**\***. Profile rescued by special-case except PLAYER.

| Role | dash | venue | customers | club | tournament | finance | tenant | reports | crm | messaging | ai | admin | profile | support | extra zones |
|------|------|-------|-----------|------|------------|---------|--------|---------|-----|-----------|----|-------|---------|---------|-------------|
| SUPER_ADMIN / PLATFORM_ADMIN | * | * | * | * | * | * | * | * | * | **Y** | * | * | Y | * | all |
| VENUE_OWNER / TENANT_OWNER | Y | Y | Y | Y | Y | Y | Y | Y | Y | **N** | Y | Y | Y | Y | — |
| VENUE_MANAGER | Y | Y | Y | Y | Y | N | N | Y | Y | **N** | Y | N | Y | Y | — |
| CASHIER | Y | Y | N | N | N | Y | N | N | N | **N** | N | N | Y | Y | — |
| CLUB_OWNER / CLUB_MANAGER | Y | N | Y | Y | Y | N | N | N | N | **N** | N | N | Y | Y | — |
| COACH | N | N | N | Y | N | N | N | N | N | **N** | N | N | Y | Y | — |
| REFEREE | N | N | N | Y | N | N | N | N | N | **N** | N | N | Y | Y | referee-zone |
| PLAYER | N | N | N | Y | Y | N | N | N | N | **N** | N | N | **N** | Y | player-zone |
| SYSTEM_TECHNICIAN | N | N | N | N | N | N | N | N | N | **N** | N | N | Y | Y | system-tech-zone |
| TEAM_CAPTAIN | N | N | N | N | N | N | N | N | N | **N** | N | N | Y | Y | team-captain-zone |
| TOURNAMENT_MANAGER | Y | N | N | N | Y | N | N | Y | N | **N** | N | N | Y | Y | — |
| STAFF | Y | Y | N | N | N | N | N | N | N | **N** | N | N | Y | Y | — |
| CUSTOMER | N | N | N | Y | N | N | N | N | N | **N** | N | N | N | Y | player-zone |
| ACCOUNTANT (legacy) | Y | N | N | N | N | Y | N | Y | N | **N** | N | N | Y | Y | — |

Canonical L1 differs (e.g. COACH = CLB + Hỗ trợ only — matches V5 groups more tightly than V5 **item** over-exposure inside `club`).

Approximate unique V5 paths: PLATFORM_ADMIN 68, TENANT_OWNER 62, VENUE_MANAGER 48, CASHIER 17, CLUB_MANAGER 34, COACH 17, REFEREE 21, PLAYER 17, SYSTEM_TECHNICIAN 19.

---

## ROLE_ROUTE_MATRIX (gate vs menu)

`canAccessRoute`: empty permission list → **allow** authenticated user. Prefix `/tournament/` → `TOURNAMENT_VIEW`.

| Role | Typical accessible routes | Notable blocks | URL-only gaps |
|------|---------------------------|----------------|---------------|
| PLATFORM_ADMIN | All | Dev routes extra-guarded | none |
| TENANT_OWNER | Ops + finance + CRM + tournament hubs | Platform-only admin leaves | `/messages` allowed by route, hidden in menu |
| VENUE_MANAGER | Ops + tournament + CRM; no finance/admin | Finance 403 if bookmarked | `/messages` same |
| CASHIER | Dashboard, venue, finance, profile, support | Rankings / waiting list / court-engine **in menu** likely **403** | Menu over-expose |
| CLUB_MANAGER | Club + customers + tournament hubs | Venue calendar 403 | Organizer Experience URLs if TOURNAMENT_VIEW |
| COACH | Entire `club` folder (coaching + my-club + daily-play + manage clubs) | Tournament group hidden | Over-broad vs Canonical |
| REFEREE | Club folder + `/referee` `/tournaments` `/statistics` `/mobile/qr-scan` | Venue ops hidden | Club over-broad |
| PLAYER | Player/club/tournament player hubs | Prefix block: `/daily-play`, `/tournament/types`, `/operations`, `/config` | **Can open `/tournament/:id/overview|settings|...` if they know URL** (`TOURNAMENT_VIEW` prefix) |
| TEAM_CAPTAIN | Captain zone | Paths null without tournamentId | `/crm/messages` as “tin nhắn đội” |
| SYSTEM_TECHNICIAN | Tech zone + coming-soon | Product ops hidden by group | Live admin routes still permission-gated |
| TOURNAMENT_MANAGER | Dashboard + tournament + reports | Venue/finance hidden | Experience URLs with TOURNAMENT_VIEW |

`/support` requires `SUPPORT_TICKET_MANAGE` **or** `BILLING_VIEW`. Menu shows Hỗ trợ to almost every role → **menu-shown / route-denied** for many.

`/messages` permissions `[]` → any authenticated user; menu hides it except `*`.

---

## ROLE_ACTION_GAPS

| ID | Gap | Roles | Class |
|----|-----|-------|-------|
| RA-01 | Organizer Experience screens only gated by `TOURNAMENT_VIEW` | PLAYER, view-only | Actions reachable without organizer permission |
| RA-02 | `messaging` missing from `ROLE_MENU_MAP` | All except platform admin | Hidden despite route allow |
| RA-03 | `/support` permission tighter than menu | Most roles | Click → 403 |
| RA-04 | CASHIER sees rankings, waiting list, court-engine | CASHIER | Shown but unauthorized |
| RA-05 | COACH/REFEREE inherit full CLB folder | COACH, REFEREE | Shown extra club admin |
| RA-06 | PLAYER `/manage/clubs` “Tạo CLB” | PLAYER | Depends on `CLUB_CREATE` |
| RA-07 | Captain resolvePath null | TEAM_CAPTAIN | Broken primary action |
| RA-08 | CRM “Thông báo” → mobile push settings | CRM-visible roles | Misleading action |
| RA-09 | Experience `/director` ≠ Director Mode runtime | Organizers | Two ops surfaces |
| RA-10 | Canonical vs V5 menu sets differ on Production | All | Same role, different IA |

---

## ROLE_UX_CRITICAL_GAPS

**P0 (security/authorization gap — record only; do not fix in this audit baseline):**  
Organizer Experience routes under `/tournament/:id/*` are currently protected too broadly by `TOURNAMENT_VIEW`.  
A PLAYER with direct URL knowledge may reach organizer surfaces.

1. PLAYER (and any `TOURNAMENT_VIEW`) can open frozen organizer 23 screens by URL.  
2. Messaging hidden from intended operators.  
3. Support menu → 403.  
4. CASHIER menu → 403 on several leaves.  
5. Dual menu systems (Canonical Production shell vs V5).  

```
ROLE_UX_CRITICAL_GAPS=5
P0_GAPS=1
```
