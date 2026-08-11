# TEAM-TOURNAMENT-RPC-OVERLOAD-REMEDIATION-01

**DO NOT APPLY** until Owner GO. Staging only first. Production separate GO.

## Proven diagnosis (read-only)

Live PR #412 captain confirm diagnostic markers showed:

1. `[TT412_GROUP_PERSIST_DECISION]` `shouldPersistGroups=true`
2. **No** `[TT412_REPLACE_GROUPS_CALL]`
3. `[TT412_CAPTAIN_CONFIRM_RESULT]` `RPC_FAILED` / “Could not choose the best candidate function…”

Therefore the failure happens **before** `team_tournament_replace_groups`.

### Failing RPC

`team_tournament_get_setup`

Called from:

`applyAiGeneratedTeamsToTournament` → `cloudGetTeamTournamentSetup` → `rpcTeamTournamentGetSetup(tournamentId)` **without** `p_schema_version`.

Client JSON body:

```json
{
  "p_tournament_id": "<text>",
  "p_viewer_team_id": null
}
```

### Staging / Production overloads

| Function | Overloads | Notes |
|----------|-----------|-------|
| `team_tournament_get_setup` | **2** | **Ambiguous** |
| `team_tournament_replace_groups` | 1 | Not the live failure |
| `team_tournament_replace_matchups` | 1 | OK |
| `team_tournament_save_draft` | 1 | OK |
| `team_tournament_update_setup_config` | 1 (Staging) | OK |
| `team_tournament_update_matchup_schedule` | 1 | OK (`update_schedule` name unused) |

### Ambiguous candidates

1. **STALE** `(p_tournament_id text, p_viewer_team_id text)` — reintroduced by dreambreaker `40_randomize_lineup_parity` (2026-08-09) after P1.3 dropped it
2. **CANONICAL** `(p_tournament_id text, p_viewer_team_id text, p_schema_version integer, p_diagnostic boolean)` — P1.2 S1-C / P1.3

PostgREST sees both as valid for a 2-named-arg body because the 4-arg form has defaults on `p_schema_version` / `p_diagnostic`.

## Remediation

Minimal SQL: `DROP FUNCTION public.team_tournament_get_setup(text, text);`

Preserve canonical 4-arg + authenticated EXECUTE grant.

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Read-only inventory / GO gates |
| `02_REMEDIATE.sql` | Drop stale 2-arg only |
| `03_VERIFY.sql` | Prove unique canonical signature |
| `04_ROLLBACK.sql` | Optional thin 2-arg wrapper (reintroduces ambiguity — avoid) |

## Optional code hardening (separate workstream)

Pass `{ schemaVersion: 7 }` from `cloudGetTeamTournamentSetup` so even dual overloads resolve uniquely. SQL drop remains the durable fix.

## Safety

- No RLS/RBAC broaden
- No tournament data rewrite
- No drop of canonical 4-arg
- No Production apply without separate Owner GO
