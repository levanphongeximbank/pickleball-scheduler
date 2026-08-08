# Route & Component Cutover Map

| Route | Before | After | Action |
|-------|--------|-------|--------|
| `/tournament` | `TournamentShell` → `TournamentHome` | `CanonicalTournamentHubPage` | REPLACE |
| `/tournament/create` | shell section=create | `CanonicalTournamentCreatePage` | REPLACE |
| `/tournament/list` | shell section=list | `CanonicalTournamentListPage` | REPLACE |
| `/tournament/types` | `InPageNavHub` | `CanonicalTournamentTypesHubPage` | REPLACE |
| `/tournament/types/:category` | section page + blob list | `CanonicalTournamentTypePage` | REPLACE |
| `/tournament/roster` | `InPageNavHub` | `CanonicalTournamentRosterPage` | REPLACE |
| `/tournament/register` | `TournamentPickerHub`+blob | `CanonicalTournamentRegisterPage` | REPLACE |
| `/tournament/organize` | `InPageNavHub` | `CanonicalTournamentOrganizePage` | REPLACE |
| `/tournament/operations` | `InPageNavHub` | `CanonicalTournamentOperationsPage` | REPLACE |
| `/tournament/results` | `InPageNavHub` | `CanonicalTournamentResultsPage` | REPLACE |
| `/tournament/my` | portal + domain service | portal + `tournamentQueries` | REWIRE |
| `/daily-play` | launcher + domain create | launcher + canonical commands | REWIRE |
| `/tournament/entry-fee` | duplicate fee page | `Navigate` → `/tournament/config/fee` | REDIRECT_TO_CANONICAL |
| `/tournaments/:id/engine|seed|draw|schedule|courts|ranking|logs` | EngineV4 | unchanged deep/contextual | KEEP_DEEP_LINK_ONLY |
| `/referee` | RefereeHub | unchanged capability entry | KEEP |

## Demoted components

| Component | Status |
|-----------|--------|
| `TournamentHome.jsx` | DEMOTED (legacy reference; Vietnamese labels retained) |
| `TournamentPickerHub.jsx` | REWIRED to `listTournamentsQuery`; secondary hubs only |
| `TournamentShell/List/Create` page files | thin re-exports of canonical pages |
