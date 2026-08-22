# High-Traffic Screen Inventory

## Counting and classification

`TOTAL_AUTHENTICATED_SCREEN_COUNT=183`
`HIGH_TRAFFIC_CANDIDATE_COUNT=42`
`PROPOSED_WAVE3_SCREEN_COUNT=22`

The count is route-entry based at `src/router.jsx`: 187 `MainLayout` path entries minus four redirects and the layout-only mobile parent, plus standalone authenticated `/change-password`.

Every authenticated destination is classified by the exhaustive route families below:

- `CORE_HIGH_TRAFFIC`: the 42 routes in the candidate register.
- `FROZEN`: `/tournament` when Experience A1 is enabled, plus `/tournament/:tournamentId/{overview,settings,registration,participants,pairs,pair-draw,group-draw,groups,schedule,matches,standings,knockout,bracket,director,courts,referees,exceptions,communications,media,awards,complete}`.
- `SPECIAL_RUNTIME`: `/referee`, `/referee/match/:matchId`, `/tournament/{daily,internal,official,team,director}/:tournamentId*`, `/team-portal/:tournamentId`, `/team-referee/:tournamentId`, `/tournaments/:tournamentId/{engine,seed,draw,schedule,courts,ranking,logs}`, `/mobile/{qr-scan,qr-generate,operations,player,notifications}`, and `/dev/pairing-intervention-preview`.
- `ADMIN`: `/users*`, `/admin/*`, `/audit`, `/platform/clubs`, and `/internal/hard-cutover/operator-acceptance`.
- `SECONDARY`: `/profile`, `/notifications`, `/messages`, `/statistics`, `/reports`, `/ai`, `/support*`, `/settings*`, `/marketplace*`, `/billing*`, `/finance/*`, and `/crm/*`.
- `DEFER_WAVE4`: non-selected coaching screens, customer groups, court revenue/ops-log, and player self-service profile/assessment screens.
- `DEFER_WAVE5`: tournament creation/configuration leaves, team builders, referee assignment, publishing, awards, withdrawal, registration, bracket, and legacy engine leaves not covered above.
- `DEFER_WAVE6`: `/court-management/calendar/preview` and the page-owned matrix gap inside `/court-management/calendar`.
- `PUBLIC`: none in the authenticated total; all `PublicLayout`, auth pages, `/referee/:token`, and `/tournament/:tournamentId/public` are explicitly outside this inventory.

## Candidate register

| # | Route | Module | Classification | Disposition |
|---:|---|---|---|---|
| 1 | `/dashboard` | Dashboard | CORE_HIGH_TRAFFIC | PILOT_ALREADY_ADOPTED |
| 2 | `/court-management` | Court | CORE_HIGH_TRAFFIC | PARTIAL_ADOPT |
| 3 | `/court-management/calendar` | Court | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 4 | `/court-management/bookings` | Court/Operations | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 5 | `/court-management/courts` | Court | CORE_HIGH_TRAFFIC | PILOT_ALREADY_ADOPTED |
| 6 | `/court-engine` | Court | SPECIAL_RUNTIME | KEEP_DOMAIN_SPECIFIC |
| 7 | `/select-players` | Operations | CORE_HIGH_TRAFFIC | PARTIAL_ADOPT |
| 8 | `/mobile/check-in` | Operations | CORE_HIGH_TRAFFIC | PARTIAL_ADOPT |
| 9 | `/mobile/qr-scan` | Operations | SPECIAL_RUNTIME | KEEP_DOMAIN_SPECIFIC |
| 10 | `/mobile/qr-generate` | Operations | SPECIAL_RUNTIME | KEEP_DOMAIN_SPECIFIC |
| 11 | `/mobile/operations` | Operations | SPECIAL_RUNTIME | PARTIAL_ADOPT |
| 12 | `/court-management/customers` | Customer | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 13 | `/court-management/members` | Customer | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 14 | `/players` | Player | CORE_HIGH_TRAFFIC | PILOT_ALREADY_ADOPTED |
| 15 | `/players/profile/:playerId` | Player | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 16 | `/players/skill` | Player/Rating | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 17 | `/player/profile` | Player | SECONDARY | DEFER_WAVE4 |
| 18 | `/player/skill` | Player/Rating | SECONDARY | DEFER_WAVE4 |
| 19 | `/club` | Club | SECONDARY | DEFER_LEGACY_CONVERGENCE |
| 20 | `/my-club` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 21 | `/discover-clubs` | Club | SECONDARY | DEFER_WAVE4 |
| 22 | `/my-club/requests` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 23 | `/manage/clubs` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 24 | `/manage/clubs/:clubId` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 25 | `/coaching/coaches` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 26 | `/coaching/students` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 27 | `/coaching/classes` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 28 | `/coaching/schedule` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 29 | `/coaching/packages` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 30 | `/coaching/attendance` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 31 | `/coaching/evaluations` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 32 | `/tournament` | Tournament outer | FROZEN | FROZEN |
| 33 | `/tournament/list` | Tournament outer | CORE_HIGH_TRAFFIC | ADOPT_SHARED_UI |
| 34 | `/tournaments` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 35 | `/tournament/types` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 36 | `/tournament/roster` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 37 | `/tournament/organize` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 38 | `/tournament/operations` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 39 | `/tournament/results` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 40 | `/tournament/config` | Tournament outer | SECONDARY | REMAIN_DOMAIN_COMPOSITION |
| 41 | `/admin/skill-level-requests` | Player/Rating admin | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 42 | `/platform/clubs` | Club admin | CORE_HIGH_TRAFFIC | ADOPT_NOW |

## Locked Wave 3 priority set

| Priority | Screen routes | Adoption scope |
|---|---|---|
| P0 | `/court-management/calendar`, `/court-management/bookings`, `/court-management/customers`, `/court-management/members`, `/players/skill`, `/admin/skill-level-requests` | Header, filters, state, responsive data, feedback/status; preserve writers |
| P0 | `/manage/clubs`, `/platform/clubs`, `/manage/clubs/:clubId` | Shared registry/header/responsive member patterns; preserve V2 fail-closed reads and governance |
| P0 | `/coaching/coaches`, `/coaching/students`, `/coaching/classes`, `/coaching/schedule`, `/coaching/packages`, `/coaching/attendance`, `/coaching/evaluations` | One shared `CoachingEntityPage` migration serving seven routes |
| P0 | `/tournament/list` | Shared auth framing/states only; preserve tournament row and destination rules |
| P1 | `/court-management`, `/mobile/check-in`, `/players/profile/:playerId`, `/my-club`, `/my-club/requests` | Shared framing/feedback only; retain domain composition |
| DEFER | all other candidates | Wave 4/5/6 or domain/frozen ownership |

The selected list contains 22 routes: six court/customer/rating routes, three registry/detail routes, seven coaching routes, one tournament outer hub, and five partial-adoption operational/player/club routes.

For every selected route: route, authorization, source, mutations, and domain authority remain unchanged.
