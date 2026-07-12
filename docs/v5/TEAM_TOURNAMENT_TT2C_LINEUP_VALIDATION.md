# Phase TT-2C — Server-side Lineup Validation

**Status:** Staging applied  
**Production impact:** NONE  
**Verdict target:** READY FOR TT-2D

## Scope (TT-2C only)

Server/RPC is the source of truth for cloud lineup save/submit:

- Roster eligibility and team membership
- Active player status (profiles)
- Gender rules per discipline (from server-resolved gender, never client payload)
- MLP participation count on submit when `formatPreset = mlp_4`
- Duplicate player / slot / cross-discipline reuse
- Draft vs submit strictness
- Shared validation contract for client UX + parity tests

**Out of scope:** randomize, publish atomicity, forfeit, override lineup, realtime, TT-3, Production.

## Artifacts

| Layer | Path |
|-------|------|
| SQL (validation core) | `docs/v5/PHASE_TT2C_LINEUP_VALIDATION.sql` |
| SQL (submit hook) | `docs/v5/PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql` |
| Client contract | `src/features/team-tournament/engines/lineupValidationContract.js` |
| Client engine | `src/features/team-tournament/engines/lineupValidationEngine.js` |
| RPC passthrough | `src/features/team-tournament/services/teamTournamentRpcService.js` |
| Repository UX | `src/features/team-tournament/repositories/teamTournamentRepositoryValidation.js` |
| Apply script | `scripts/apply-phase-tt2c-staging-sql.mjs` |
| Gender prep | `scripts/prep-tt2c-staging-player-genders.mjs` |
| Staging verify | `scripts/verify-phase-tt2c-validation.mjs` |
| Unit parity | `tests/team-tournament-lineup-validation-parity.test.js` |
| Evidence | `docs/v5/qa-evidence/phase-tt2/TT2C_VALIDATION_REPORT.json` |

## Validation contract

Server returns (and client maps):

```json
{
  "ok": false,
  "code": "invalid_gender",
  "message": "...",
  "fieldErrors": {},
  "ruleViolations": [],
  "invalidPlayerIds": [],
  "invalidDisciplineIds": [],
  "serverTime": "2026-07-12T...",
  "lineupVersion": 1
}
```

Error codes: `player_not_in_team`, `player_inactive`, `player_not_eligible`, `invalid_gender`, `invalid_discipline`, `duplicate_player`, `duplicate_slot`, `roster_limit_exceeded`, `lineup_incomplete`, `lineup_locked`, `deadline_passed`, `captain_scope_denied`, `cross_tenant_denied`, `version_conflict`.

## Server functions (staging)

- `team_tournament_normalize_gender_key`
- `team_tournament_resolve_player_gender_key` — profiles → club_data_v3 fallback
- `team_tournament_resolve_player_status`
- `team_tournament_validate_lineup_selections(header, team_id, matchup_id, selections, is_submit)`
- `team_tournament_save_lineup_draft_legacy` — draft mode validation
- `team_tournament_submit_lineup` — full submit validation before persist

## Draft vs submit

| Mode | Allows incomplete | Blocks |
|------|-------------------|--------|
| Draft (`is_submit=false`) | Yes (warnings) | outsider players, cross-tenant, over-limit, duplicates, inactive |
| Submit (`is_submit=true`) | No | all draft checks + full lineup + gender + MLP 2-game rule |

## Staging probe

- Tournament: `phase23d-probe-tournament`
- Team A: `phase23d-team-a`
- Matchup: `phase23d-matchup-1`
- Captain: `player@staging.local`

## Runbook

```bash
# 1. Apply SQL (if not already via MCP)
node scripts/apply-phase-tt2c-staging-sql.mjs

# 2. Seed probe player genders (required for gender tests)
node scripts/prep-tt2c-staging-player-genders.mjs

# 3. Staging verification
node scripts/verify-phase-tt2c-validation.mjs

# 4. Unit tests
npm test -- tests/team-tournament-lineup-validation-parity.test.js
npm test -- tests/team-tournament-portal.test.js

# 5. TT-2B regression
node scripts/verify-phase-tt2b-deadline.mjs
```

## Parity principle

Client validation (`lineupValidationEngine.js`) is UX-only. Cloud mutations must never trust client-sent `playerId`, gender, or team scope. Staging verify compares client structured codes with server RPC codes for the same invalid payloads.

## Known limits (TT-2C)

- MLP WD/MD mixed pairing rules (1 same-gender + 1 mixed) enforced client-side; server enforces 2-game count on submit for `mlp_4` only.
- DreamBreaker order validation minimal (excluded from TT-2C except slot existence).
- Legacy 4-param `team_tournament_submit_lineup` overload unchanged; cloud client uses 6-param TT-1B contract.

## Next phase

After owner review: **TT-2D** (not started in this phase).
