# Wave 0 — Tournament Experience route classification (pre-implementation)

**Worktree:** `web-app-p0-organizer-auth-01`  
**Branch:** `fix/web-app-p0-organizer-auth-01`  
**Base:** `38bddf1006e0f93458cfe2fb56747058877ae90e`  
**Status:** CLASSIFICATION COMPLETE + IMPLEMENTED  
**Owner decision:** overview/matches/standings/knockout/bracket = **O** (TOURNAMENT_UPDATE)  
**Architecture:** Experience `/tournament/:id/*` = organizer workspace; spectators use `/public`

---

## AUTHORIZATION_SSOT

| Field | Value |
|-------|-------|
| AUTHORIZATION_SSOT | `getRouteAccessPermissions` → `canAccessRoute` → `RouteAccessGate` (`shouldRedirectToForbidden`) |
| ROUTE_GUARD_IMPLEMENTATION | `src/auth/menuAccess.js` + `src/components/auth/RouteAccessGate.jsx` (wired from MainLayout / CanonicalAppShell) |
| CURRENT_FALLTHROUGH | `pathname.startsWith("/tournament/")` → `[PERMISSIONS.TOURNAMENT_VIEW]` (`tournament.view`) |
| EXISTING_ORGANIZER_PARITY | Plural Engine `/tournaments/:id/*` already requires `PERMISSIONS.TOURNAMENT_UPDATE` |
| NEW_PERMISSION_SYSTEM | NO (proposed) |

Exact `ROUTE_PERMISSIONS` today for Experience family:

- `/tournament/:tournamentId/register` → `TOURNAMENT_VIEW`
- `/tournament/:tournamentId/public` → `TOURNAMENT_VIEW` (registry only; route is **outside** MainLayout)
- all other `/tournament/:id/*` Experience paths → **no exact entry** → fallthrough `TOURNAMENT_VIEW`

---

## Permission semantics proof

### Labels / scope

| Permission | String | UI label | Default scope |
|------------|--------|----------|---------------|
| TOURNAMENT_VIEW | `tournament.view` | Xem giải đấu | SELF |
| TOURNAMENT_UPDATE | `tournament.update` | Cập nhật giải đấu | CLUB |

### TOURNAMENT_VIEW_ROLES (canonical ROLE_PERMISSIONS)

`PLATFORM_ADMIN`, `TENANT_OWNER`, `VENUE_MANAGER`, `TOURNAMENT_MANAGER`, `TEAM_CAPTAIN`, `CLUB_MANAGER`, `COACH`, `REFEREE`, `STAFF`, `PLAYER`, `CUSTOMER`

Aliases: `SUPER_ADMIN→PLATFORM_ADMIN`, `VENUE_OWNER→TENANT_OWNER`, `CLUB_OWNER→CLUB_MANAGER`.

**Not in VIEW set:** `CASHIER`, `ACCOUNTANT`, `SUPPORT`, `SYSTEM_TECHNICIAN` (default matrix).

### TOURNAMENT_UPDATE_ROLES (canonical ROLE_PERMISSIONS)

`PLATFORM_ADMIN`, `TENANT_OWNER`, `VENUE_MANAGER`, `TOURNAMENT_MANAGER`, `CLUB_MANAGER`

**Explicitly without UPDATE:** `PLAYER`, `REFEREE`, `COACH`, `CASHIER`, `STAFF`, `TEAM_CAPTAIN`, `CUSTOMER`, `SYSTEM_TECHNICIAN`.

### TOURNAMENT_UPDATE_EXISTING_USAGE

Proven organizer/operator authority today:

1. Plural Engine family `/tournaments/:id/{engine|…}` → `TOURNAMENT_UPDATE` (`tournamentEngineRouteAccess` + `getRouteAccessPermissions`)
2. Legacy director deep-link prefix `/tournament/director/` → `DIRECTOR_USE` **or** `TOURNAMENT_UPDATE`
3. Experience settings page mutation chrome → `PermissionGate(TOURNAMENT_UPDATE)`
4. Organizer action map mutations (lock participants, draw/schedule prepare, courts confirm, check-in, knockout activate, publish, complete, archive) → require `TOURNAMENT_UPDATE` and/or `DIRECTOR_USE`
5. Team-tournament manage / cloud gates / many club tournament writers → `TOURNAMENT_UPDATE`
6. Product comment in team lifecycle: never grant `tournament.update` to athletes

`ORGANIZER_ACTION.OPERATIONS_READ` still maps to `TOURNAMENT_VIEW` at **action** layer — that is a competition-engine capability map, **not** a route-gate SSOT for Experience UI shells.

### TOURNAMENT_UPDATE_IS_APPROPRIATE_FOR_ORGANIZER_ROUTES

**YES** — for routes already proven as organizer/operator administration surfaces.

It is the existing organizer authority used by Engine + settings + mutation actions. It does **not** invent a new permission taxonomy.

It is **not automatically correct** for every `/tournament/:id/*` path (see AMBIGUOUS_ROUTES). Blind prefix→UPDATE would over-block potential viewer-safe Experience URLs if Owner wants those preserved under VIEW.

---

## Name alias map (Owner brief → canonical routes)

| Owner brief name | Canonical route |
|------------------|-----------------|
| overview | `/tournament/:tournamentId/overview` |
| settings | `/tournament/:tournamentId/settings` |
| registration | `/tournament/:tournamentId/registration` |
| participants | `/tournament/:tournamentId/participants` |
| pairs | `/tournament/:tournamentId/pairs` |
| pair-draw | `/tournament/:tournamentId/pair-draw` |
| group-draw | `/tournament/:tournamentId/group-draw` |
| groups | `/tournament/:tournamentId/groups` |
| schedule | `/tournament/:tournamentId/schedule` |
| matches | `/tournament/:tournamentId/matches` |
| standings | `/tournament/:tournamentId/standings` |
| knockout | `/tournament/:tournamentId/knockout` |
| bracket | `/tournament/:tournamentId/bracket` |
| director | `/tournament/:tournamentId/director` |
| assignments | `/tournament/:tournamentId/referees` (+ courts board is related ops) |
| operations | `/tournament/:tournamentId/exceptions` |
| communications | `/tournament/:tournamentId/communications` |
| media | `/tournament/:tournamentId/media` |
| awards | `/tournament/:tournamentId/awards` |
| complete | `/tournament/:tournamentId/complete` |
| public | `/tournament/:tournamentId/public` |
| (athlete register) | `/tournament/:tournamentId/register` |

There is **no** Experience route named `/assignments` or `/operations`; those map to `referees` / `exceptions`.

---

## Full canonical Experience route matrix

Legend:

- **A** PLAYER_VIEW_SAFE  
- **B** PUBLIC  
- **C** REFEREE_SPECIFIC  
- **D** ORGANIZER_READ  
- **E** ORGANIZER_MUTATION  
- **?** AMBIGUOUS — Owner decision required before implement

| ROUTE | SCREEN | CLASS | CURRENT_PERMISSION | CURRENT_ROLE_BEHAVIOR | PLAYER_DIRECT_URL_ACCESS (today) | EXPECTED_AUDIENCE | EXPECTED_PERMISSION (proposed if decided) | MUTATION_CAPABILITY | Evidence |
|-------|--------|-------|--------------------|----------------------|----------------------------------|-------------------|---------------------------------------------|---------------------|----------|
| `/tournament/:id/public` | Public Experience | **B PUBLIC** | registry VIEW; **no MainLayout gate** | Anonymous + any role via Public layout | N/A (public layout) | Public spectator | keep public / no organizer UPDATE | NONE | Outside MainLayout; tabs include standings/bracket/results |
| `/tournament/:id/register` | Athlete registration | **A PLAYER_VIEW_SAFE** | exact `TOURNAMENT_VIEW` | PLAYER ALLOW | ALLOW | Athlete | keep `TOURNAMENT_VIEW` | WRITE (athlete) | Exact ROUTE_PERMISSIONS; inventory “athlete write” |
| `/tournament/:id/settings` | Settings | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | PermissionGate UPDATE; Owner DENY list |
| `/tournament/:id/registration` | Registration publication | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Organizer publish/registration admin |
| `/tournament/:id/participants` | Participants | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Lock participants → UPDATE in action map |
| `/tournament/:id/pairs` | Pair formation | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Pairing authority / organizer workspace |
| `/tournament/:id/pair-draw` | Pair draw room | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Draw prepare → UPDATE |
| `/tournament/:id/group-draw` | Group draw room | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Draw prepare → UPDATE |
| `/tournament/:id/groups` | Group stage | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Inventory READ_WRITE operator screen |
| `/tournament/:id/schedule` | Schedule | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Schedule prepare → UPDATE |
| `/tournament/:id/director` | Director ops | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Owner DENY list; director ops |
| `/tournament/:id/courts` | Court board | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Courts confirm → UPDATE/DIRECTOR |
| `/tournament/:id/referees` | Referee assignment board | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Owner “assignments” DENY; **not** referee runtime |
| `/tournament/:id/exceptions` | Exception / incidents | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Owner “operations” |
| `/tournament/:id/communications` | Communications admin | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Owner DENY list |
| `/tournament/:id/media` | Media presentation admin | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ (admin shell) | Owner DENY list; operator Batch F |
| `/tournament/:id/awards` | Awards admin | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | READ_WRITE | Owner DENY list |
| `/tournament/:id/complete` | Complete tournament | **E ORGANIZER_MUTATION** | fallthrough VIEW | PLAYER ALLOW (bug) | ALLOW (P0) | Organizer | `TOURNAMENT_UPDATE` | WRITE | Complete action → UPDATE; Owner DENY |
| `/tournament/:id/overview` | Overview | **?** | fallthrough VIEW | PLAYER ALLOW | ALLOW | Unclear | TBD | READ (ops dashboard chrome) | Subtitle “Bảng điều hành vận hành”; also listed in public tabs via **/public** |
| `/tournament/:id/matches` | Match center | **?** | fallthrough VIEW | PLAYER ALLOW | ALLOW | Unclear | TBD | READ_WRITE | “mở trận” ops; scoring not on page; Batch D operator nav |
| `/tournament/:id/standings` | Standings | **?** | fallthrough VIEW | PLAYER ALLOW | ALLOW | Unclear | TBD | READ | Operator chrome + disabled “Khóa BXH”; public has standings tab |
| `/tournament/:id/knockout` | Knockout | **?** | fallthrough VIEW | PLAYER ALLOW | ALLOW | Unclear | TBD | READ_WRITE | Inventory READ_WRITE; Batch D operator nav |
| `/tournament/:id/bracket` | Bracket | **?** | fallthrough VIEW | PLAYER ALLOW | ALLOW | Unclear | TBD | READ | Operator chrome; public has bracket tab |

### REFEREE_SPECIFIC (Experience family)

**None.**

- `/tournament/:id/referees` = **organizer assignment board** (class E), not referee match execution.
- Referee runtime remains `/referee`, `/referee/match/:matchId` (and token scoreboard) — **out of Wave 0 Experience route rewrite**, must stay unchanged.

### Adjacent non-`:id` surfaces (not in 23 mutation set, for regression)

| Route | Class note | Permission today |
|-------|------------|------------------|
| `/tournament` hub | PLAYER-visible hub | exact VIEW |
| `/tournament/my`, `/tournament/my/:id` | PLAYER portal | exact VIEW |
| `/tournament/list` etc. | legacy hubs | VIEW / restricted prefixes |

---

## Role matrix preview (decided organizer routes only)

If decided E routes use `TOURNAMENT_UPDATE`:

| Role | Organizer E routes | Notes |
|------|--------------------|-------|
| SUPER_ADMIN / PLATFORM_ADMIN | ALLOW | all perms |
| VENUE_OWNER / TENANT_OWNER | ALLOW | UPDATE granted |
| VENUE_MANAGER | ALLOW | UPDATE granted |
| CLUB_OWNER / CLUB_MANAGER | ALLOW | UPDATE granted |
| TOURNAMENT_MANAGER | ALLOW | UPDATE granted |
| COACH | DENY | VIEW only |
| REFEREE | DENY on Experience organizer; referee runtime unchanged | VIEW+MATCH_UPDATE, no UPDATE |
| PLAYER | DENY | VIEW only |
| CASHIER | DENY | no tournament perms |
| TEAM_CAPTAIN / STAFF / CUSTOMER | DENY on E | VIEW without UPDATE |

Ambiguous routes omitted until Owner picks VIEW vs UPDATE.

---

## Proposed implementation strategy (blocked until Owner resolves ?)

1. Extend `getRouteAccessPermissions` with **pattern matching** for Experience `:tournamentId` segments (do not broaden prefix `/tournament/` alone).
2. Map **decided E routes** → `[TOURNAMENT_UPDATE]`.
3. Keep **A** register → `[TOURNAMENT_VIEW]`.
4. Keep **B** public outside MainLayout; do **not** require UPDATE; leave public access regression-free.
5. Do **not** change referee `/referee*` gates.
6. Fail closed via existing `RouteAccessGate` → `/403` (or safe home) **before** child page render when RBAC on.
7. Add direct-URL tests for Owner DENY list + organizer ALLOW + public/register unchanged.
8. **NEW_PERMISSION_SYSTEM=NO**, no UI redesign, no SQL.

---

## Owner decisions required

Please choose one policy for each AMBIGUOUS route:

### Option V — PLAYER_VIEW_SAFE (keep `TOURNAMENT_VIEW`)

Preserves current authenticated player/direct-URL read of Experience standings/bracket/etc.  
Public page remains the anonymous surface.

### Option O — ORGANIZER_READ (require `TOURNAMENT_UPDATE`)

Treats these as organizer workspace URLs only.  
Players/viewers use `/tournament/:id/public` (and `/tournament/my`) for standings/bracket/overview.

| AMBIGUOUS_ROUTE | Recommended default if Owner wants max P0 closure | Alternative if Owner wants preserve viewer URL |
|-----------------|-----------------------------------------------------|------------------------------------------------|
| overview | **O** (ops dashboard copy) | V |
| matches | **O** (match open / ops nav) | V |
| standings | O *or* V | V (public already covers) |
| knockout | **O** (READ_WRITE inventory) | V |
| bracket | O *or* V | V (public already covers) |

**STOP_NOW=YES — awaiting Owner choice on AMBIGUOUS_ROUTES before any auth mapping commit.**
