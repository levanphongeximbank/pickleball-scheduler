# Current State Map — Phase 3P

**Baseline:** `3650b48` (`origin/main` = Phase 3A.2 merge)  
**Source of truth:** filesystem + Phase 3 inventory docs, not roadmap alone.

---

## 1. Competition-core folder reality

| Path | Exists | Owns |
|------|--------|------|
| `participants/` | YES | Participant + Entry + Registration + Team + Roster + Lineup + Division/Category **contracts** |
| `seed/` | YES | Canonical seed pipeline + contracts |
| `draw/` | YES | Draw contracts, strategy, runtime adapters |
| `formation/` | YES | Team formation / pairing adapters |
| `matchmaking/` | YES | Matchmaking adapters |
| `scheduling/` | YES | Scheduling contracts + adapters |
| `standings/` | YES | Standings calc + adapters |
| `constraints/` | YES | Rules engine + bridges |
| `rating/` | YES | Competition Elo V2 |
| `runtime-control/` | YES | 3A.1 control plane + 3A.2 shadow infra |
| `registration/` | **NO** | — |
| `team/` | **NO** | — |
| `lineup/` | **NO** | — |
| `match/` | **NO** | use `matchmaking/` + `formation/` |
| `lifecycle/` | **NO** | enum only |
| `publication/` | **NO** | enum only |

---

## 2. Capability map (11)

### Participant

| Field | Value |
|-------|-------|
| Canonical | `src/features/competition-core/participants/**` |
| Legacy | Club players / tournament entries in blob; plan builders normalize players |
| Format-local | TT hydration/athlete pool; IND/Daily adapters under `*/adapters/competition-core/` |
| Adapters | `teamTournamentParticipantAdapters.js`, `individualTournamentParticipantAdapters.js`, `dailyPlayParticipantAdapters.js`, `internalOfficialParticipantAdapters.js` |
| Contracts | `identity.js`, `competitionParticipant.js`, `shared.js` |
| Tests | `tests/competition-core-participants-2b2/2b3/2b4*.test.js` |
| Runtime entry | Setup/portals hydrate players — **no** core participant executor |
| Public exports | Via root `competition-core/index.js` → participants barrel |
| Shared deps | Schema v1, identity kinds, statuses |
| Downstream | Format adapters (tests/QA); seed/draw consume participant refs |
| Upstream | None (foundation) |
| Database | Ports stub only (`createInMemoryParticipantPorts`) |
| Prod request path | **Does not** invoke canonical participant executor |
| Comparator location (potential) | `participants/runtime/` or `runtime-control/shadow/comparators/participant*` |
| Shadow fixture (potential) | `tests/fixtures/shadow/participant/` |
| Migration blockers | Triple ID / identity collision; persistence ports unimplemented |

### Registration (+ Entry)

| Field | Value |
|-------|-------|
| Canonical | Same `participants/` — `contracts/entryRegistration.js` |
| Legacy | Tournament `entries[]` in club blob |
| Format-local | `individual-tournament/engines/registrationEngine.js`, `eligibilityEngine.js` |
| Adapters | Format participant adapters; `legacyEntryToEntryMapper` |
| Contracts | Entry, Registration (waitlist OD-10), EligibilityDecision |
| Tests | Participants 2b2–2b4; Phase 2B.4 registration evidence docs |
| Runtime entry | `IndividualRegistrationPage` → registrationEngine → `updateTournament` |
| Public exports | Entry/Registration factories, validators, DTOs, port method lists |
| Shared deps | **HARD** on Participant identity |
| Downstream | Seeding (entries), Draw (field), eligibility gates |
| Upstream | Participant |
| Database | Blob; TT cloud for TT eligibility path |
| Prod request path | Format engine only — **no** canonical |
| Comparator location | `registration/runtime/` (new) or under participants with ownership split |
| Migration blockers | Owner WRAP decision pending historically; waitlist parity |

### Team (+ Roster)

| Field | Value |
|-------|-------|
| Canonical | `participants/contracts/teamRosterLineup.js` (contracts only) |
| Legacy | Pairing engines (not team SSOT) |
| Format-local | **SSOT:** `team-tournament/engines/teamRosterEngine.js`, `teamTournamentEngine.js`, service + repos |
| Adapters | TT participant adapters; legacy team/roster mappers |
| Contracts | Team, Roster, RosterMember, substitution |
| Tests | Participants 2b3/2b4; `tests/team-tournament*.js` |
| Runtime entry | Team setup / TeamPortal → teamTournamentService |
| Owner decision | **KEEP IN FORMAT** (`14_OWNER_DECISION_MATRIX.md`) |
| Shared deps | ParticipantReference (**CONTRACT_ONLY** / SOFT) |
| Downstream | Lineup |
| Database | `team_tournament_*` tables/RPCs — outside competition-core |
| Prod request path | Format-owned — **no** core cutover intended as rewrite |

### Lineup

| Field | Value |
|-------|-------|
| Canonical | Same `teamRosterLineup.js` + lineup validators |
| Format-local | `lineupEngine.js`, state machine, validation, atomic publish, override workflows |
| Adapters | TT adapters; Rules V2 lineup validation bridges in `constraints/` |
| Contracts | Lineup, Revision, Slot |
| Owner decision | **KEEP IN FORMAT** (rules bridge only) |
| Shared deps | **HARD** on Team/Roster membership |
| Prod request path | Format-owned |

### Seeding

| Field | Value |
|-------|-------|
| Canonical | `src/features/competition-core/seed/**` (`runCanonicalSeedPipeline`) |
| Legacy | `pages/tournament.seeding.logic.js`, TE `seedEngine.js`, `seededGroupEngine.js` |
| Format-local | TT `teamGroupSeedEngine.js`; IND rating seed adapter |
| Adapters | `draw/adapters/seedShadowCompare.js` (no Production seed runtime adapter) |
| Contracts | `seed/seedContracts.js` |
| Tests | `competition-core-seed-foundation.test.js` |
| Prod request path | Legacy only; pipeline unused by Production |

### Draw

| Field | Value |
|-------|-------|
| Canonical | `src/features/competition-core/draw/**` |
| Legacy | Internal/Official plan builders, open conditional, seeded groups |
| Format-local | TT auto-draw; TE drawEngine |
| Adapters | `drawRuntimeAdapter.js`, `teamDrawAdapter.js` — **still call legacyExecutor** |
| Tests | draw-foundation, strategy, runtime-adapter, cc04e |
| Prod request path | Wrapper may map when flag ON; business output = legacy |

### Match (generation / pairing)

| Field | Value |
|-------|-------|
| Canonical | `matchmaking/**` + `formation/**` |
| Legacy | `src/ai/engine.js`, `teamPairingEngine.js` |
| Format-local | Daily play; TT AI pairing dialog |
| Adapters | matchmaking + formation runtime adapters |
| Prod request path | Daily still `runAI` direct (adapter unwired); TT formation may wrap legacy |

### Schedule

| Field | Value |
|-------|-------|
| Canonical | `scheduling/**` |
| Legacy | `scheduleEngine.js` (+ reverse dep to page fixtures logic) |
| Format-local | TT round-robin schedule; TE re-export |
| Adapters | `schedulingRuntimeAdapter.js` |
| Prod request path | Plan builders call legacy schedule **direct** |

### Lifecycle (match lifecycle / scoring)

| Field | Value |
|-------|-------|
| Canonical | **MISSING** — only `RUNTIME_CAPABILITY.MATCH_LIFECYCLE` / `SCORING` + `lifecycleMarkers.js` |
| Legacy | `matchEngine.js`, `domain/tournamentLifecycle.js` |
| Format-local | IND matchResultEngine; TT teamResultEngine / rallyScoring; Referee V5 |
| Adapters | None in competition-core |
| Prod request path | Score UI → lifecycle → Elo/season — **Critical hotspot** |
| Migration blockers | Side effects (Elo, season, live RPC); multi-stack |

### Standings

| Field | Value |
|-------|-------|
| Canonical | `standings/**` (`calculateCanonicalStandings`) |
| Legacy | `rankingEngine.js`, season standings |
| Format-local | IND adapter can use canonical-primary **if** STANDINGS_V2 on; TT still direct |
| Prod request path | Default flags OFF → legacy |

### Publication

| Field | Value |
|-------|-------|
| Canonical | **MISSING** — capability enum + flag key only |
| Legacy | `publishDrawEngine.js`, `publishScheduleEngine.js` |
| Format-local | TT atomic publish; IND portal projection |
| Owner | Public projection **DEFER** historically |
| Prod request path | Legacy/format publish controls |

---

## 3. Runtime control / shadow (3A.1 + 3A.2)

| Item | State |
|------|-------|
| `RUNTIME_EXECUTOR` | `{ LEGACY }` only — **no CANONICAL** |
| Runtime decision clamp | Always LEGACY_ONLY / shadowAllowed false / canonicalAllowed false |
| Shadow eligibility default | `false` |
| Empty allowlist | deny |
| Capability comparator registry | **Does not exist** |
| Generic compare | `compareShadowResults` only |
| Production wiring | **NONE** |

---

## 4. Shared integration hotspots

1. `src/features/competition-core/index.js`
2. `src/features/competition-core/participants/index.js` + `contracts/**` + validators/mappings/ports barrels
3. `src/features/competition-core/runtime-control/index.js` + `shadow/**`
4. `src/features/competition-core/config/featureFlags.js`
5. `src/features/competition-core/adapters/legacyAdapter.js`
6. `scripts/ci/unit-test-files.json`
7. `scripts/ci/competition-architecture-lock*`
8. Format adapters under `src/*/adapters/competition-core/`

---

## 5. Bottom line

```text
Contracts: mature for Participant family; strong for Seed/Draw/Standings/Scheduling
Canonical Production executors: ZERO (default)
Greenfield needed: Lifecycle, Publication modules; Participant/Registration runtime
Highest parallelization risk: co-located participants/* for 3B/3C/3D/3E
```
