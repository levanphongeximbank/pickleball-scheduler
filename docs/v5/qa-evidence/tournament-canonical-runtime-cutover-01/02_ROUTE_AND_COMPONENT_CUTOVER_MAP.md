# Route & Component Cutover Map

| Route | Component | Authority |
|-------|-----------|-----------|
| `/tournament` | CanonicalTournamentHubPage | cloud list |
| `/tournament/create` | CanonicalTournamentCreatePage | cloud create / TT cloud_only |
| `/tournament/list` | CanonicalTournamentListPage | cloud list |
| `/tournament/my` | IndividualPlayerPortalPage | cloud listMine + update |
| `/tournament/daily/:id` | DailyPlaySetup | useCanonicalTournament |
| `/tournament/internal/:id` | InternalTournamentSetup | useCanonicalTournament |
| `/tournament/official/:id` | OfficialTournamentSetup | useCanonicalTournament |
| `/tournament/*/bracket` | TournamentBracketPage | cloud get + assertLoaded |
| `/tournament/director/:id` | Director | cloud get/update |
| Engine routes | useTournamentEngine | applyEngineV4StateCommand |
| `/tournament/team/:id` | TeamTournamentSetup | TT cloud authority |
| TournamentHome.jsx | **DEMOTED / not mounted** | legacy blob (inactive) |
