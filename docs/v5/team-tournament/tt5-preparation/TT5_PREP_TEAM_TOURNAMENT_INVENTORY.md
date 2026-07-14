# TT-5 Preparation — Team Tournament Inventory

**Phase:** TT-5 PREPARATION  
**Date:** 2026-07-13

---

## Source report

```text
Repository path:  c:\Users\Le Phong\pickleball-scheduler
Remote:           https://github.com/levanphongeximbank/pickleball-scheduler.git
Branch:           feature/competition-core-standardization
HEAD SHA:         23462878782726b9f933380071126245bd767dec
Working tree:     DIRTY (shared workspace)
Open PR:          Not verified (gh unavailable)
Current TT phase: TT-4 complete (92142db); TT-1B through TT-4 committed
Staging status:   Extended TT schema on staging (includes command_log, forfeit_events, dreambreaker_states)
Production status: Core TT tables exist; fewer auxiliary tables than staging
```

### TT phase commit map (git)

| Phase | Commit SHA | Message |
|-------|------------|---------|
| TT-1B | `44d7ce3` | repository and SSOT foundation |
| TT-1B.5 | `cd5cb27` | staging verification evidence |
| TT-1C | `db97280` | cloud-primary UI flow |
| TT-2A | `866744b` | lineup state machine |
| TT-2B | `2ab79ad` | server-time lineup deadline |
| TT-2C | `63b7779` | server-side lineup validation |
| TT-2D | `c433a27` | randomize and lock workflow |
| TT-2E | `7f297d8` | atomic publish workflow |
| TT-3 | `15e85ff` | controlled lineup override |
| TT-4 | `92142db` | forfeit withdrawal workflow |

Pilot branch (`qa/team-tournament-pilot-preparation` @ `e5126a1`) adds TT-7–TT-10 prep docs; **not** merged into main TT branch.

---

## Database inventory (logical → physical)

User-requested names mapped to **actual Supabase table names**:

| Logical | Staging table | Production | Notes |
|---------|---------------|------------|-------|
| `team_tournaments` | `team_tournaments` | Yes | Tournament header |
| `teams` | `team_tournament_teams` | Yes | Renamed prefix |
| `team_members` | `team_tournament_team_members` | Yes | |
| `disciplines` | `team_tournament_disciplines` | Yes | |
| `matchups` | `team_tournament_matchups` | Yes | |
| `lineups` | `team_tournament_lineups` | Yes | |
| `lineup_entries` | `team_tournament_lineup_entries` | Yes | |
| `sub_matches` | `team_tournament_sub_matches` | Yes | **Primary bridge target for V5 match_id** |
| `standings` | `team_tournament_standings` | Yes | |
| `audit_logs` | `team_tournament_audit_logs` | Yes | |

### Staging-only TT extensions

```text
team_tournament_command_log
team_tournament_forfeit_events
team_tournament_dreambreaker_states
team_tournament_lineup_revisions
team_tournament_sync_mismatch
```

SQL sources: `docs/v5/PHASE_TT1B_*.sql` through `PHASE_TT4_*.sql`

---

## Code inventory

| Object / file | Vai trò | Source of truth hiện tại | Test | Ghi chú |
| ------------- | ------- | ------------------------ | ---- | ------- |
| `TeamRefereePortal.jsx` | Legacy TT referee UI | Client + `teamRefereeEngine` + RPC | `tests/team-tournament-referee.test.js` | Route `/team-referee/:tournamentId` |
| `teamRefereeEngine.js` | Sub-match scoring rules, draft/confirm flow | Client engine | team-tournament-referee.test.js | **Duplicate scoring logic vs V5** |
| `refereeSaveSubMatchDraft` | Persist draft score | `teamTournamentService.js` → cloud RPC | team-tournament-workflow.test.js | Legacy path |
| `refereeConfirmSubMatch` | Confirm final sub-match | `teamTournamentService.js` → cloud RPC | team-tournament-referee.test.js | Legacy path |
| `teamStandingsEngine.js` | Team standings calculator | Client engine (recompute) | team-standings-tiebreak.test.js | Used by portal + cloud sync |
| `teamResultEngine.js` | Matchup / sub-match result aggregation | Client engine | team-tournament.test.js | `computeMatchupResult`, `recordSubMatchResult` |
| `atomicPublishWorkflowEngine.js` | Lineup publish / republish readiness | Client + server RPC | team-tournament-tt3.test.js | TT-2E/TT-3 |
| `lineupStateMachine.js` | Lineup lifecycle | Client | team-tournament-workflow.test.js | TT-2A |
| `lineupValidationEngine.js` | Server-aligned validation contract | Client | TT-2C tests | |
| `forfeitWorkflowEngine.js` | Forfeit / withdrawal | Client + TT-4 SQL | TT-4 evidence | |
| `cloudTeamTournamentRepository.js` | Cloud SSOT reads/writes | Supabase RPC | team-tournament-cloud.test.js | TT-1B |
| `teamTournamentRpcService.js` | RPC facade | Supabase | team-tournament-cloud.test.js | |
| `/team-referee/:tournamentId` | Route | `src/router.jsx` (committed) | portal tests | **No V5 wiring** |
| `teamPortalRouteScope.js` | Auth scope for team portals | Client | — | Defines TEAM_REFEREE_PREFIX |

### Lineup publish / reveal

| Component | Path | Role |
|-----------|------|------|
| Atomic publish engine | `engines/atomicPublishWorkflowEngine.js` | Client-side publish readiness |
| Override workflow | `engines/overrideLineupWorkflowEngine.js` | TT-3 republish |
| Server RPC | `PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql`, `PHASE_TT3_LINEUP_OVERRIDE.sql` | Authoritative publish |
| UI | `TeamMatchupOperationsCard.jsx`, `TeamTournamentSetup.jsx` | Publish controls |

---

## Three parallel referee tracks (no integration today)

| Track | Route | State store | TT-5 relevance |
|-------|-------|-------------|----------------|
| Classic token referee | `/referee/:token` | `tournament_match_live` | Out of TT-5 scope |
| Team Tournament legacy | `/team-referee/:tournamentId` | `team_tournament_sub_matches` | **Replace target** |
| Referee V5 prototype | `/dev/referee-v5` | `match_live_states` + Edge | **Integration source** |

**No import or adapter** connects `team-tournament` module to `referee-v5` module in committed or uncommitted code.

---

## Staging vs production gap (TT)

Production missing (vs staging): `team_tournament_command_log`, `team_tournament_forfeit_events`, `team_tournament_dreambreaker_states`, `team_tournament_lineup_revisions`, `team_tournament_sync_mismatch`.

TT-5 integration should assume **staging-first** validation; production TT-4 parity is a separate release gate.

---

## Module size

| Path | Files (approx) |
|------|----------------|
| `src/features/team-tournament/` | 69 |
| `tests/team-tournament*.test.js` | 10+ |
| TT SQL docs | 12 phase files |
