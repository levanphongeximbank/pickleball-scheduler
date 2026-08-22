# High-Traffic Screen Inventory

## Counting and classification

`TOTAL_AUTHENTICATED_SCREEN_COUNT=180`
`HIGH_TRAFFIC_CANDIDATE_COUNT=42`
`PROPOSED_WAVE3_SCREEN_COUNT=22`

The count is route-entry based at `src/router.jsx`: rendered `MainLayout` destinations only. Four redirect aliases and the layout-only mobile parent are removed; the court-management index destination is included.

Every authenticated destination is classified by the exhaustive route families below:

- `CORE_HIGH_TRAFFIC`: the 42 routes in the candidate register.
- `FROZEN`: `/tournament/:tournamentId/{overview,settings,registration,participants,pairs,pair-draw,group-draw,groups,schedule,matches,standings,knockout,bracket,director,courts,referees,exceptions,communications,media,awards,complete}`.
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
| 2 | `/court-management` | Court | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 3 | `/court-management/calendar` | Court | CORE_HIGH_TRAFFIC | PARTIAL_ADOPT |
| 4 | `/court-management/bookings` | Court/Operations | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 5 | `/court-management/courts` | Court | CORE_HIGH_TRAFFIC | PILOT_ALREADY_ADOPTED |
| 6 | `/court-engine` | Court | SPECIAL_RUNTIME | KEEP_DOMAIN_SPECIFIC |
| 7 | `/select-players` | Operations | CORE_HIGH_TRAFFIC | PARTIAL_ADOPT |
| 8 | `/mobile/check-in` | Operations | CORE_HIGH_TRAFFIC | ADOPT_NOW |
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
| 19 | `/club` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 20 | `/my-club` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 21 | `/discover-clubs` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 22 | `/my-club/requests` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 23 | `/manage/clubs` | Club | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 24 | `/manage/clubs/:clubId` | Club | CORE_HIGH_TRAFFIC | PARTIAL_ADOPT |
| 25 | `/coaching/coaches` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 26 | `/coaching/students` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 27 | `/coaching/classes` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 28 | `/coaching/schedule` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 29 | `/coaching/packages` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 30 | `/coaching/attendance` | Coaching | CORE_HIGH_TRAFFIC | ADOPT_NOW |
| 31 | `/coaching/evaluations` | Coaching | SECONDARY | DEFER_WAVE4 |
| 32 | `/tournament` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 33 | `/tournament/list` | Tournament outer | CORE_HIGH_TRAFFIC | ADOPT_SHARED_UI |
| 34 | `/tournaments` | Tournament outer | CORE_HIGH_TRAFFIC | ADOPT_SHARED_UI |
| 35 | `/tournament/types` | Tournament outer | CORE_HIGH_TRAFFIC | ADOPT_SHARED_UI |
| 36 | `/tournament/roster` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 37 | `/tournament/organize` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 38 | `/tournament/operations` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 39 | `/tournament/results` | Tournament outer | CORE_HIGH_TRAFFIC | REMAIN_DOMAIN_COMPOSITION |
| 40 | `/tournament/config` | Tournament outer | SECONDARY | ADOPT_SHARED_UI |
| 41 | `/tournament/create` | Tournament outer | CORE_HIGH_TRAFFIC | DEFER_LEGACY_CONVERGENCE |
| 42 | `/tournament/bracket` | Tournament outer | SECONDARY | DEFER_LEGACY_CONVERGENCE |

## Locked Wave 3 priority set

| Priority | Screen routes | Adoption scope |
|---|---|---|
| P0 | `/court-management`, `/court-management/bookings`, `/mobile/check-in`, `/court-management/customers`, `/court-management/members`, `/players/skill` | Header, filters, state, responsive data, feedback/status; preserve writers |
| P0 | `/coaching/coaches`, `/coaching/students`, `/coaching/classes`, `/coaching/schedule`, `/coaching/packages`, `/coaching/attendance` | One shared `CoachingEntityPage` migration serving six routes |
| P1 | `/select-players`, `/players/profile/:playerId`, `/club`, `/my-club`, `/discover-clubs`, `/my-club/requests`, `/manage/clubs` | Shared framing/states only; retain domain composition |
| P1 | `/tournament/list`, `/tournaments`, `/tournament/types` | Shared auth framing on outer hubs only |
| DEFER | all other candidates | Wave 4/5/6 or domain/frozen ownership |

The selected list contains 22 routes: six P0 operations/customer/player, six coaching routes, seven P1 operations/player/club routes, and three tournament outer hubs.

For every selected route: route, authorization, source, mutations, and domain authority remain unchanged.
