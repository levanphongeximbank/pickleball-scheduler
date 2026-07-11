# CC-04A — Draw Engine Audit

**Phase:** CC-04A | **Date:** 2026-07-12 | **Scope:** Read-only inventory (no runtime changes)

---

## Summary

Two parallel draw trees exist. Only tree A is wired to production tournament creation. Tree B powers AI Assistant advisory + feature orchestrator tests. Snake distribution is reimplemented in at least five places.

---

## Inventory

### A. Production tournament engines (`src/tournament/engines/`)

| Engine | File | Role |
|--------|------|------|
| Seeded / snake | `seededGroupEngine.js` | `assignEntriesToGroupsSnake` via `seedTeamsIntoGroups(skill_controlled)` |
| Open / constrained random | `openConditionalRandomEngine.js` | Multi-attempt shuffle + club/unit penalty placement |
| Official orchestrator | `officialTournamentEngine.js` | Open → openConditional; AI Balance → `assignGroupsWithConstraints` |
| Internal orchestrator | `internalTournamentEngine.js` | Always `assignGroupsWithConstraints` |
| Pairing / seed prep | `teamPairingEngine.js` | Entries before draw |
| Validation | `validationEngine.js` | Pre-draw validation (Rules V2 bridge when flag ON) |
| Knockout | `bracketEngine.js` | Bracket seeding (related, not group draw) |

### B. Feature tournament-engine (`src/features/tournament-engine/`)

| Engine | File | Role |
|--------|------|------|
| Heuristic draw | `engines/drawEngine.js` | Seeded `mulberry32`, retry+score; fallback to tree A snake |
| Seed engine | `engines/seedEngine.js` | Weighted seed scoring |
| Orchestrator | `orchestrator/tournamentEngine.js` | Seed→Draw→Schedule pipeline |
| UI hook | `hooks/useTournamentEngine.js` | **Stub path** via `runPlatformEngineWorkflow` |

### C. Pairing constraints

| Engine | File | Role |
|--------|------|------|
| Group assignment | `constraintGroupEngine.js` | Snake + `avoid_same_group` repair |
| Group evaluation | `constraintEvaluator.js` | `evaluateGroupConstraints` |
| Partner repair | `constraintPairingEngine.js` | Prefer/avoid partner swaps (`Math.random`) |

### D. Team tournament

| Engine | File | Role |
|--------|------|------|
| Team seed primitives | `teamGroupSeedEngine.js` | Sort / shuffle / snake groups |
| Auto draw / MLP | `teamAutoDrawEngine.js` | Team formation + group seeding |
| Direct snake | `teamTournamentEngine.js` | `assignTeamsToGroupsSnake` |
| Lineup random | `lineupRandomEngine.js` | Legacy random lineup fill |

### E. Legacy weekly seeding

| Engine | File | Role |
|--------|------|------|
| Seed helpers | `pages/tournament.seeding.logic.js` | `createTeamsFromPlayers`, `seedTeamsIntoGroups`, `buildSeededGroups` |

### F. Animation (display)

| Module | File | Role |
|--------|------|------|
| Animation utils | `components/tournament/animation/animationUtils.js` | `buildSnakeSteps`, `buildRandomDrawSteps`, `assertGroupsMatch` |
| Flow adapters | `tournamentFlowAdapters.js` | Persist plans after animation |

---

## Call graph (simplified)

```
OfficialSetup
  ├─ buildOfficialOpenPlan → assignEntriesOpenConditional
  └─ buildOfficialAiBalancePlan → assignGroupsWithConstraints → assignEntriesToGroupsSnake

InternalSetup
  └─ buildInternalTournamentPlan → assignGroupsWithConstraints → assignEntriesToGroupsSnake

TeamSetup / TeamGroupDivisionPanel
  ├─ assignSeededTeamsToGroups → buildSnakeGroupsFromSortedTeams
  ├─ applyMlpAutoDraw → assignSeededTeamsToGroups
  └─ randomizeMissingLineups

AI Assistant
  └─ generateDraw (feature drawEngine) → fallback assignEntriesToGroupsSnake

EngineDrawTab
  └─ runPlatformEngineWorkflow (STUB — no real draw)
```

---

## Runtime matrix

| Mode | Engine | Constraints | RNG | Output |
|------|--------|-------------|-----|--------|
| Official Open | openConditional | club/unit penalties | Math.random / injected | groups |
| Official AI Balance | constraints + snake | avoid_same_group + partner | Math.random in partner repair | groups |
| Internal | constraints + snake | avoid_same_group | swap search | groups |
| Legacy weekly | seedTeamsIntoGroups | none | Math.random (open) | rounds |
| Team seeded | snake groups | seedingMode | random when OFF | teamData.groups |
| Team MLP | MLP + snake | gender/roster heuristics | randomFn | teams+groups |
| AI advisory | heuristic drawEngine | club/seed scoring | mulberry32 | suggestion |
| Engine UI tab | stub | none | none | placeholder |

---

## Additional paths found

1. Knockout bracket seeding (`bracketEngine`) — bracket, not group draw.
2. Daily Play fairness pairing — not a group draw.
3. Stub `runPlatformEngineWorkflow` Draw tab — no real engine.
4. Five snake implementations (seededGroupEngine, drawEngine.snakeAssign, teamGroupSeedEngine, teamTournamentEngine, animationUtils).

---

## Risks for later phases

- Non-deterministic AI Balance partner repair
- Animation may diverge from persisted groups (`assertGroupsMatch` warns only)
- Dual snake/heuristic trees increase drift risk
- Group constraint algorithm changes deferred to CC-04B+
