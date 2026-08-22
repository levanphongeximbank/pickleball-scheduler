# Customer / Player Adoption Matrix

`CUSTOMER_PLAYER_SCREEN_COUNT=30`
`CUSTOMER_PLAYER_ADOPT_NOW_COUNT=5`
`PLAYER_CROSS_DOMAIN_LEAK_COUNT=8`

| Route group | Count | Adoption decision |
|---|---:|---|
| Operator player management (`/players`, skill, detail, select) | 4 | Keep `/players` pilot; adopt skill/detail; select remains domain-specific |
| Self profile and rating | 5 | Defer except shared framing when touched |
| Authenticated athlete directory | 2 | Defer Wave 4; preserve privacy projection |
| Membership / club-player surfaces | 4 | Club batch owns shell/member adoption |
| Verification / rating admin | 2 | Adopt `/admin/skill-level-requests`; verification queue defers |
| Customer/member operations | 3 | Adopt customers and members; customer groups defer |
| CRM outreach | 5 | Defer Wave 5; zero Tournament imports |
| Mobile check-in/player routes | 5 | Operations batch owns check-in; other mobile routes remain runtime-specific |

## Five selected routes

1. `/players/skill` — remove Tournament header/card/layout; preserve proposal engine, approval audit, and RBAC.
2. `/admin/skill-level-requests` — remove Tournament header/layout; preserve rating writes and audit.
3. `/players/profile/:playerId` — canonical page/state framing; preserve tenant, privacy, and rating guards.
4. `/court-management/customers` — canonical filter/responsive data/feedback; preserve merge, debt, and booking semantics.
5. `/court-management/members` — canonical filter/responsive data/status; preserve membership expiry and booking linkage.

`/players` remains `PILOT_ALREADY_ADOPTED`; its three child layout-token imports are normalization work, not a second screen migration.

## Eight inappropriate Tournament UI imports

1. `SkillLevelsPage.jsx` → `TournamentPageHeader`
2. `SkillLevelsPage.jsx` → `TournamentSectionCard`
3. `SkillLevelsPage.jsx` → `TOURNAMENT_LAYOUT`
4. `SkillLevelRequestsPage.jsx` → `TournamentPageHeader`
5. `SkillLevelRequestsPage.jsx` → `TOURNAMENT_LAYOUT`
6. `SelectPlayers.jsx` → `EffectPreludeScreen`
7. `SelectPlayers.jsx` → `EFFECT_PRELUDE_SCOPE`
8. `CourtManagementFuturePage.jsx` → `TournamentCourtScheduleManager`

Separately, six mobile routes import the frozen `MOBILE_PAGE_GUTTER` bridge and one skill page imports a legitimate engine enum. They are classified in the cross-domain matrix, not counted as inappropriate player leaks.

## Safety

- Player CRUD, initial-rating lock, rating visibility, membership status, privacy, and permission gates remain untouched.
- Existing form dialogs remain domain-owned.
- Row/card actions retain current permission checks and mutation functions.
- Status tone adoption must not rename or coerce rating, check-in, linkage, or membership values.
