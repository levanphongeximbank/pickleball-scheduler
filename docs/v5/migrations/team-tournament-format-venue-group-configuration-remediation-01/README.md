# Team Tournament Format / Venue / Group Configuration — Migration Package

**Status:** LOCAL ONLY — DO NOT APPLY without separate Owner GO.

## Decision

| Flag | Value |
|------|-------|
| EXISTING_SETTINGS_JSON_SUFFICIENT | **YES** — `team_tournaments.settings` jsonb can store all new keys |
| SQL_REQUIRED | **YES** — `team_tournament_save_draft` only merges `draftState`; need whitelist merge RPC for Format & Venue keys |

## Files

1. `01_UPDATE_SETUP_CONFIG_RPC.sql` — `tournament.update_setup_config`
2. `02_VERIFICATION.sql` — post-apply checks
3. `03_ROLLBACK.sql` — drop RPC + restore constraint

## Whitelisted settings keys

- formatPreset
- rosterRules
- dreambreakerEnabled
- groupMode
- groupCount
- qualificationCount
- knockoutFormat
- selectedCourtIds
- teamsPerGroup

## Gate

Client remains behind `VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7` (default OFF).
RPC is registered in client registry but **not** marked deployed until Owner apply.
