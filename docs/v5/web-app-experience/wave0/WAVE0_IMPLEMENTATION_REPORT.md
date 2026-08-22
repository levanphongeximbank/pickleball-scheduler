# Wave 0 — Organizer Route Authorization Closure

**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\web-app-p0-organizer-auth-01`  
**Branch:** `fix/web-app-p0-organizer-auth-01`  
**Base:** `38bddf1006e0f93458cfe2fb56747058877ae90e`  
**Owner GO:** YES (ambiguous routes decided O → TOURNAMENT_UPDATE)

---

## FINAL_CLASSIFICATION

| Class | Routes | Permission |
|-------|--------|------------|
| PUBLIC | `/tournament/:id/public` | VIEW (outside MainLayout) |
| PLAYER_VIEW_SAFE | `/tournament/:id/register` | TOURNAMENT_VIEW |
| ORGANIZER_WORKSPACE | overview, settings, registration, participants, pairs, pair-draw, group-draw, groups, schedule, matches, standings, knockout, bracket, director, courts, referees, exceptions, communications, media, awards, complete | TOURNAMENT_UPDATE |
| REFEREE_RUNTIME | `/referee`, `/referee/match/:id` | unchanged |

Architecture: Experience `/tournament/:id/*` = organizer workspace. Spectators use `/public`.

---

## IMPLEMENTATION

| Item | Value |
|------|-------|
| AUTHORIZATION_SSOT | `getRouteAccessPermissions` (`src/auth/menuAccess.js`) |
| ROUTE_GUARD | existing `RouteAccessGate` → `/403` (or safe home) |
| HELPER | `src/auth/tournamentExperienceRouteAccess.js` (no parallel guard) |
| NEW_PERMISSION_SYSTEM | NO |
| UI / App Shell / Design system | unchanged |
| SQL | none |

---

## SECURITY ASSERTIONS

PLAYER_DIRECT_URL organizer workspace = DENY  
PRIVATE_DATA_FLASH_BEFORE_DENIAL = NO (gate before children)  
PUBLIC_ROUTE_ACCESS_UNCHANGED = YES  
PLAYER_REGISTER_ACCESS_UNCHANGED = YES  
REFEREE_RUNTIME_UNCHANGED = YES  
AUTHORIZED_ORGANIZER (UPDATE roles) = ALLOW  

---

## TESTS

`tests/web-app-p0-organizer-auth-wave0.test.js` (A–F + role matrix)

---

## OWNER_REVIEW_REQUIRED

YES — Draft PR only; do not merge until Owner review.
