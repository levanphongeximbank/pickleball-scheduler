# Wave 1 — Tournament Canonical Hub Promotion

**Program:** CANONICAL-NAVIGATION-FINAL-PARITY-01  
**Branch:** `fix/canonical-navigation-final-parity-01`  
**Base:** `origin/main` @ `b58829d025c804cb1cc2ae7608f5d79f9503e5c5`  
**Scope:** approved Tournament hub exposure only

## Owner bindings applied

| Binding | Result |
|---------|--------|
| B02 route retention | PRESERVED |
| B02 broad menu hide | Replaced by an explicit fail-closed allowlist |
| Invented plural redirects | 0 |
| B03 Rating V5 shadow | PRESERVED |
| Tournament Engine | Contextual-only; not a generic sidebar surface |
| RBAC / permissions / guards | Reused from existing route inventory |
| Tenant isolation / operational gates | Unchanged |

## Promoted route allowlist

| Label | Route | Existing permission / guard |
|-------|-------|-----------------------------|
| Tổng quan | `/tournament` | `tournament.view` / `RouteAccessGate` |
| Danh sách giải | `/tournament/list` | `tournament.view` / `RouteAccessGate` |
| Tạo giải | `/tournament/create` | `tournament.create` / `RouteAccessGate` |
| Loại giải | `/tournament/types` | `tournament.view` / `RouteAccessGate`, player block |
| Danh sách VĐV | `/tournament/roster` | `tournament.view` / `RouteAccessGate` |
| Đăng ký | `/tournament/register` | `tournament.view` / `RouteAccessGate` |
| Tổ chức giải | `/tournament/organize` | `tournament.view` / `RouteAccessGate` |
| Điều hành giải | `/tournament/operations` | `tournament.view` / `RouteAccessGate`, player block |
| Kết quả | `/tournament/results` | `tournament.view` / `RouteAccessGate` |
| Cấu hình | `/tournament/config` | `tournament.view` / `RouteAccessGate`, player block |
| Chơi hằng ngày | `/daily-play` | `tournament.view` / `RouteAccessGate`, player block |
| Trọng tài | `/referee` | authenticated, existing referee permissions |
| Giải của tôi | `/tournament/my` | `tournament.view` / `RouteAccessGate` |

The 11 retained `/tournament*` routes form `B02_TOURNAMENT_HUB_MENU_ALLOWLIST`. Daily Play and Referee remain existing canonical leaves.

## Intentional non-promotion

| Route family | Reason |
|--------------|--------|
| `/tournaments/:tournamentId/{engine,seed,draw,schedule,courts,ranking,logs}` | contextual selected-tournament Engine navigation |
| `/tournament/*/:tournamentId` mode setup, bracket and director routes | requires selected tournament context |
| `/tournament/bracket`, teams, schedule, config subpages, eligibility, awards, withdrawal, publish schedule, referee assignment | in-page workflow; avoids duplicate primary authority |
| `/referee/:token`, `/referee/match/:matchId`, `/team-portal/:tournamentId`, `/team-referee/:tournamentId` | token/deep-link or role-specific contextual route |

## Safe allowlist behavior

`filterCanonicalMenu` now denies `/tournament` and `/tournament/*` by default and allows only a route found in `B02_TOURNAMENT_HUB_MENU_ALLOWLIST`. This changes menu exposure only:

- retained router paths are not deleted or redirected;
- unapproved legacy tournament routes stay absent from general desktop/mobile menu/search;
- contextual Engine paths stay hidden from general navigation;
- B03 `/player/skill-assessment-v5` remains hidden.

## Vietnamese labels changed in Wave 1

- `Daily Play` → **Chơi hằng ngày**
- `Launcher` → **Mở phiên**
- all 11 promoted tournament hub labels are Vietnamese

Whole-platform localization remains Wave 3 scope.

## Focused verification

`tests/canonical-navigation-final-parity-wave1.test.js` covers:

1. approved targets have live router paths, guards and Vietnamese labels;
2. SUPER_ADMIN desktop and mobile see exactly the approved retained hub allowlist;
3. unapproved legacy routes remain hidden;
4. Engine contextual routes remain hidden;
5. B03 remains hidden;
6. PLAYER cannot see the create hub without `tournament.create`.

Existing canonical Phase 3/4 tests were updated for the explicit allowlist and retained-route behavior.

## Target rejection record

`TARGET_NOT_PROMOTED_REASON`: none. Every approved target has an implemented route, non-shadow status and existing guard/permission metadata.
