# TT-5A — Current State Audit

**Phase:** TT-5A (read-only)  
**Date:** 2026-07-13  
**Integration branch:** `feature/tt5-referee-v5-integration`  
**Team Tournament base SHA:** `cb32ae2669182a81ac1cc1f41ad00f51b58b933c`  
**Referee V5 source SHA:** `a678229e7cfba7736d0f62f7d3824d3816175721`  
**Merge SHA:** `2140c81782dfdd738bf42603b7bcf7f8df9ed356`  
**Production impact:** NONE

---

## Executive summary

Post-merge integration worktree contains **both** Team Tournament TT-1B→TT-4 cloud stack and Referee V5 platform (V5-A through V5-E1). **No application bridge** connects team sub-matches to Referee V5 live matches today. Three parallel referee/score tracks coexist:

| Track | Route | Persistence |
|-------|-------|-------------|
| Classic token referee | `/referee/:token` | `tournament_match_live` |
| Team Tournament legacy portal | `/team-referee/:tournamentId` | `team_tournament_sub_matches.score` |
| Referee V5 remote | `/dev/referee-v5`, future `/referee/match/:matchId` | `match_live_states` + `match_events` |

TT-5A confirms architectural boundary feasibility; implementation requires TT-5B–TT-5F.

---

## Team Tournament — verified artifacts

### SQL (staging-ready, not applied in this audit)

| Table | Primary DDL |
|-------|-------------|
| `team_tournaments` | `docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql` |
| `team_tournament_teams` / `_team_members` | same + TT-1B patches |
| `team_tournament_disciplines` | same |
| `team_tournament_matchups` | same; `external_matchup_id`, `status`, `result` jsonb |
| `team_tournament_lineups` / `_lineup_entries` | same; publish workflow TT-2E |
| `team_tournament_sub_matches` | **`external_sub_match_id`** (text RPC key), `score`, `status`, `result_confirmed_at`, `version` |
| `team_tournament_standings` | cache table; TT-4 adds `team_tournament_recompute_standings_cache` |
| `team_tournament_audit_logs` | TT-1B command/audit trail |

### Client / engine

| Component | Path | Role |
|-----------|------|------|
| `TeamRefereePortal` | `src/pages/tournament/TeamRefereePortal.jsx` | List matchups, draft/confirm sub-match scores, forfeit dialog (TT-4) |
| `teamRefereeEngine` | `src/features/team-tournament/engines/teamRefereeEngine.js` | `saveSubMatchDraft`, `confirmSubMatchResult`, lineup gates |
| Cloud sync | `src/features/team-tournament/services/teamTournamentCloudSync.js` | RPC wrappers |
| Lineup reveal | `src/features/team-tournament/engines/lineupEngine.js` → `getVisibleLineup` | Opponent hidden until matchup published |
| Standings | `teamStandingsEngine.js`, `team_tournament_get_standings`, TT-4 recompute RPC | Multiple paths (see duplicate logic report) |
| Polling | `useTeamTournamentPage.js` | 10s poll — not V5 realtime |

### Routes

- `/team-referee/:tournamentId` — `src/router.jsx` line ~594
- Deep link: `?matchup={external_matchup_id}`

---

## Referee V5 — verified artifacts

### Domain / persistence

| Component | Path |
|-----------|------|
| Match state engine | `src/features/referee-v5/engines/matchStateEngine.js` |
| RemotePersistenceAdapter | `src/features/referee-v5/adapters/RemotePersistenceAdapter.js` |
| Realtime | `hooks/useRefereeRealtimeSync.js`, `realtime/refereeV5RealtimeChannel.js` |
| Edge | `supabase/functions/referee-v5-match/index.ts`, `_shared/refereeV5Server.mjs` |

### SQL tables (staging migrations in `docs/v5/referee-v5/`)

- `referee_assignments` — JWT user ↔ `(tenant_id, tournament_id, match_id)`
- `match_live_states` — id = `{tenant}::{tournament}::{match_id}`
- `match_events` — append-only
- `match_sync_mutations` — idempotency
- `match_result_revisions` — finalize audit
- `match_integration_outbox` — downstream hooks (**no TT consumer**)

### Routes

- `/dev/referee-v5` — staging preview (`RefereeV5PreviewPage`)
- `/referee/match/:matchId` — **legacy** `RefereeSessionScoreboard` (not V5 workspace yet)

### Edge actions

`get-state`, `apply-command`, `finalize` — **no provision/create-match action** in current edge handler.

---

## Integration gap (P0)

| Gap | Status |
|-----|--------|
| Sub-match ↔ V5 `match_id` mapping in code | **Missing** |
| Bridge table | **Not in schema** |
| Outbox → TT consumer | **Missing** |
| Disable dual scoring on linked sub-match | **Missing** |
| Unified `/referee/match/:id` → V5 UI | **Not wired** |
| Cross-imports `team-tournament` → `referee-v5` | **Zero** |

---

## Regression after merge (this audit run)

| Suite | Result |
|-------|--------|
| Referee V5 unit | 133/133 PASS |
| Referee V5 UI | 36/36 PASS |
| Legacy referee | 29/29 PASS |
| Team Tournament (core subset) | 30/30 PASS |
| Team Tournament (full `team-tournament*.test.js`) | 206/206 PASS |
| Build | PASS |
| Referee V5 scoped lint | PASS |
| Merge changed-files eslint (113 files) | PASS (0 errors) |
