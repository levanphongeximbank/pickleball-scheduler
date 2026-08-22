# Customer / Player Adoption Matrix

`CUSTOMER_PLAYER_SCREEN_COUNT=12`
`CUSTOMER_PLAYER_ADOPT_NOW_COUNT=6`
`PLAYER_CROSS_DOMAIN_LEAK_COUNT=9`

| Route | Header / filter / data / state today | Disposition | Priority |
|---|---|---|---|
| `/players` | Canonical page patterns; card grid remains domain-specific | PILOT_ALREADY_ADOPTED, normalize three child imports | P1 |
| `/players/profile/:playerId` | Ad-hoc detail composition | ADOPT_NOW framing/states | P1 |
| `/players/skill` | Tournament header/card/layout leakage | ADOPT_NOW | P0 |
| `/court-management/customers` | Ad-hoc actions/filter/table/Alert | ADOPT_NOW | P0 |
| `/court-management/members` | Ad-hoc summary/filter/table/Alert | ADOPT_NOW | P0 |
| `/mobile/check-in` | Mobile-local header/filter/data/status and tournament gutter | ADOPT_NOW | P0 |
| `/profile` | Identity self profile | KEEP_DOMAIN_SPECIFIC | DEFER |
| `/athletes` | Authenticated directory | DEFER_WAVE4 | P2 |
| `/athletes/:playerId` | Directory detail | DEFER_WAVE4 | P2 |
| `/player/profile` | Athlete self-service | DEFER_WAVE4 | P2 |
| `/player/skill` | Rating self-service | DEFER_WAVE4 | P2 |
| `/player/skill-assessment*` | Assessment runtime | KEEP_DOMAIN_SPECIFIC | DEFER |

## Nine player-domain cross-imports

1. `PlayerCard.jsx` → `tournamentLayout.js`
2. `PlayerFilters.jsx` → `tournamentLayout.js`
3. `PlayerStats.jsx` → `tournamentLayout.js`
4. `SkillLevelsPage.jsx` → `TournamentPageHeader`
5. `SkillLevelsPage.jsx` → `TournamentSectionCard`
6. `SkillLevelsPage.jsx` → `tournamentLayout.js`
7. `PlayerHomePage.jsx` → tournament `mobileUi.js`
8. `SelectPlayers.jsx` → tournament `EffectPreludeScreen`
9. `SelectPlayers.jsx` → tournament effect-prelude configuration

The first six are direct visual leaks with canonical authenticated replacements. The mobile player gutter and waiting-room animation coupling require ownership extraction before replacement; no animation or scheduling semantics may change.

## Safety

- Player CRUD, initial-rating lock, rating visibility, membership status, privacy, and permission gates remain untouched.
- Existing form dialogs remain domain-owned.
- Row/card actions retain current permission checks and mutation functions.
- Status tone adoption must not rename or coerce rating, check-in, linkage, or membership values.
