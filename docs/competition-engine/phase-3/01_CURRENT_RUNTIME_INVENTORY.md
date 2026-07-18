# 01 — Current Runtime Inventory

**Audit date:** 2026-07-18  
**Baseline:** `5f7ba8d` (`origin/main`)  
**Production executor:** Legacy + format-local (Competition Core inactive)

---

## 1. Runtime stack classification

| Stack ID | Class | Primary paths | Production role |
|----------|-------|---------------|-----------------|
| LEGACY | LEGACY | `src/tournament/engines/*`, `src/pages/tournament.*.logic.js`, `src/ai/*`, `src/domain/tournamentService.js`, `tournamentLifecycle.js`, `eloService.js` | **Primary** Daily / Internal / Official |
| TE4 | TOURNAMENT_ENGINE_4 | `src/features/tournament-engine/**` | Parallel engine UI — not setup SSOT |
| CC | COMPETITION_CORE | `src/features/competition-core/**` | Contracts/adapters/shadow; flags OFF |
| TT | FORMAT_LOCAL | `src/features/team-tournament/**` | Team V6 roster/lineup/standings/publish |
| IND | FORMAT_LOCAL | `src/features/individual-tournament/**` | Registration, eligibility, match results |
| DAILY | FORMAT_LOCAL | `src/tournament/engines/dailyPlayEngine.js` + AI | Daily fair matches |
| SHARED | SHARED_UTILITY | `src/models/tournament/*`, `src/domain/clubStorage.js`, pairing-* features | Models, blob I/O, bridges |
| SHADOW | COMPETITION_CORE | `src/*/adapters/competition-core/*`, `src/tournament/adapters/competition-core/*` | Mapping only; not Production SSOT |
| OPS | UNKNOWN | Referee V5, mobile check-in, AI Assistant | Adjacent ops — not competition SSOT |

---

## 2. Counts

| Metric | Estimate |
|--------|----------|
| Real runtime executors (compute / mutate domain) | ~45–55 |
| Wrappers / adapters (forward or map only) | ~25–35 |
| Duplicate / competing engines (by capability family) | Standings×4, Schedule×4, Draw/Seed×4, Pairing×3, Eligibility×2 |
| Capabilities with canonical **contracts** | Participant, Entry, Registration, Team, Roster, Lineup, Seed, Draw, Rules, Standings, Scheduling (partial) |
| Capabilities with canonical **Production executor** | **0** (adapters still inject legacy) |
| Grandfathered architecture debt items | **13** (`competition-architecture-lock-baseline.json`) |
| Circular / reverse dependencies | Yes — engines → `pages/*.logic.js`; core adapters → TT/legacy (grandfathered) |

---

## 3. Executor vs wrapper examples

### Real executors (sample)

| Executor | File | Writes? |
|----------|------|---------|
| `buildInternalTournamentPlan` | `tournament/engines/internalTournamentEngine.js` | Via caller patch |
| `buildOfficialOpenPlan` / `buildOfficialAiBalancePlan` | `officialTournamentEngine.js` | Via caller |
| `createDailyMatchesWithAI` / daily mutations | `dailyPlayEngine.js` + `ai/engine.js` | Via setup save |
| `gatedSubmitRegistration` | `individual-tournament/engines/registrationEngine.js` | Via `updateTournament` |
| `addPlayerToTeam` / roster ops | `team-tournament/engines/teamRosterEngine.js` | Via TT service |
| `submitLineup` / `lockMatchupLineups` | `lineupEngine.js` | Via TT service |
| `buildGroupStageSchedule` | `scheduleEngine.js` | Via caller |
| `buildGroupStandingFromMatches` | `rankingEngine.js` | Read/compute |
| `computeTeamStandings` | `teamStandingsEngine.js` | Read/compute |
| `processCompletedMatch` | `domain/tournamentLifecycle.js` | Elo + season + blob |
| `generateSeed` / `generateDraw` / TE schedule | `tournament-engine/engines/*` | Engine run log |

### Wrappers (sample)

| Wrapper | File | Behavior when flag ON |
|---------|------|------------------------|
| `runLegacyDrawWithCanonicalAdapter` | `competition-core/draw/adapters/drawRuntimeAdapter.js` | Map + trace; **still calls legacyExecutor** |
| Formation / matchmaking / scheduling / standings runtime adapters | `competition-core/*/adapters/*` | Same pattern |
| Format shadow mappers | `tournament/adapters/competition-core/*` | Map only; no Production wire |
| `wrapEngineRun` | TE4 | Logging façade |

---

## 4. Direct persistence coupling

| Component | Destination | Notes |
|-----------|-------------|-------|
| `domain/clubStorage.js` | `pickleball-club-data-v3::{clubId}` | Club blob SSOT |
| `domain/tournamentService.js` | tournaments[] in blob | Central tournament write |
| `teamTournamentService.js` | blob ± Supabase `team_tournament_*` | Dual path via DATA_MODE |
| `ratingServiceV2.js` / `ratingAtomicApply.js` | `saveClubData` | Grandfathered core→persistence |
| `ratingRpcService.js` | RPC `competition_core_apply_match_rating_v2` | Grandfathered core→Supabase |
| Referee / live | `tournament_match_live` + RPCs | Scoring ops |
| TE `engineRunLog.js` | localStorage | Side channel |

**Finding:** Several executors both compute and persist (lifecycle Elo, TT service, publish engines via service).

---

## 5. UI / ambient state coupling

| Finding | Evidence |
|---------|----------|
| Engines import page logic | `scheduleEngine`, `seededGroupEngine`, `teamPairingEngine`, `bracketEngine`, TT RR → `pages/tournament.*.logic.js` |
| TE reads active club | `getActiveClubId()` in orchestrator |
| Fat page controllers | Internal/Official/Daily setup pages orchestrate engines then patch |
| React hook as runtime façade | `useTournamentEngine.js` |
| CC React-free | Enforced by CI (except grandfathered rating paths) |

---

## 6. Feature flags (current Production)

All Competition Core flags default **OFF**. Sub-flags require master `VITE_COMPETITION_CORE_ENABLED`.

| Env key | Default | Production role |
|---------|---------|-----------------|
| `VITE_COMPETITION_CORE_ENABLED` | false | Master |
| `VITE_COMPETITION_CORE_RATING_V2_ENABLED` | false | Optional Elo path if ever enabled |
| `VITE_COMPETITION_CORE_RULES_V2_ENABLED` | false | Rules/lineup validation bridge |
| `VITE_COMPETITION_CORE_DRAW_V2_ENABLED` | false | Adapter/trace only |
| `VITE_COMPETITION_CORE_FORMATION_V2_ENABLED` | false | Adapter |
| `VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED` | false | Adapter |
| `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` | false | Shadow; legacy truth |
| `VITE_COMPETITION_CORE_SCHEDULING_V2_ENABLED` | false | Shadow adapter |
| `VITE_TEAM_TOURNAMENT_*` | format store modes | TT cloud path (separate from CC) |

Related: `VITE_RBAC_ENABLED`, `VITE_ENABLE_AI_ENGINE` (not CC).

---

## 7. Format-specific logic in shared runtime

- Private pairing competition-class constraints shared across Internal/Official
- Draw adapter consumer tags per format
- Standings mappers per format
- AI scoring used by Daily + constraint bridges
- Owner decision: teams/roster/lineup **KEEP IN FORMAT** (`14_OWNER_DECISION_MATRIX.md`)

---

## 8. Bottom line

```text
Production SSOT execution  = LEGACY + FORMAT_LOCAL
Competition Core           = strangler façade (inactive)
Tournament Engine 4        = competing parallel UI stack
Persistence ports          = stubs / in-memory fakes only
```
