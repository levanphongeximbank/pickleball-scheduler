# CORE-09 Phase 1C — Round Robin & Group Stage Generator

**Status:** Implemented (capability-local, dormant)
**Module:** `src/features/competition-core/match-generation/`
**Production impact:** NONE

Phase 1C generates **logical MatchPlans only**. It does **not** schedule date, time, court, referee, score, result, or lifecycle state.

## Delivered executors

| Strategy | Modes | Entry |
|----------|-------|-------|
| `ROUND_ROBIN` | `SINGLE`, `DOUBLE` | `generateMatchPlan(request, context)` |
| `GROUP_ROUND_ROBIN` | `SINGLE`, `DOUBLE` | same |

Public surface remains capability-local:

`src/features/competition-core/match-generation/index.js`

Root `competition-core/index.js` is **not** modified (Integrator-owned).

## Round Robin algorithm

Canonical **circle method** (Berger-style):

1. Take participants in frozen DrawSnapshot placement array order (never sort by name).
2. If N is odd, append one **virtual bye** slot (not a real participant).
3. For each round, pair opposite positions on the circle.
4. Keep index 0 fixed; rotate the remaining seats one step.
5. Deterministic A/B balancing: swap sides when `(roundIndex + pairIndex) % 2 === 1`.

### Even N

- rounds = N − 1
- matches per round = N / 2
- total played matches = N × (N − 1) / 2

### Odd N

- rounds = N
- active matches per round = (N − 1) / 2
- every participant receives **exactly one bye** per leg
- bye pairings become `LogicalMatch` with `isByeMatch=true` and a `BYE` ParticipantSlot
- **no** played match against a fake participant
- total played matches = N × (N − 1) / 2

## Double Round Robin

1. Generate leg 1 with the circle method.
2. Generate leg 2 by **reversing ParticipantSlot A/B** for every leg-1 match (including bye matches).
3. Round numbers continue: leg 2 starts at `leg1RoundCount + 1`.
4. No pair meets twice in the same logical round.
5. Total played matches = N × (N − 1).
6. Odd-participant bye recipients are identical across both legs.

`validateMatchPlanInvariants` accepts `maxDirectPairOccurrences: 2` for double RR (default remains 1 for Phase 1B single-encounter plans).

## Group Stage

For `GROUP_ROUND_ROBIN`:

1. Group catalog order = `DrawSnapshot.groupPlacements` array order.
2. Participants inside each group = placement array order filtered by `groupId`.
3. Each group is generated independently (no cross-group pairing).
4. `groupId` is bound into every `LogicalMatch` and therefore into `logicalMatchKey`.
5. Empty / invalid / duplicate placements fail closed with existing Draw issue codes.

## Deterministic ordering

- Participant order: Draw placement array order (not name / Elo / locale).
- Round order: circle round index, then continued for leg 2.
- Match order within a round: circle pairing index (matchNumber).
- Global `deterministicOrder`: sequential across the assembled plan.
- Identical canonical inputs → identical MatchPlan + `generationFingerprint`.

Forbidden: `Math.random`, `Date.now`, random UUID, `localeCompare`, DB return-order assumptions.

## Input / output sketch

```javascript
import {
  createMatchGenerationRequest,
  createMatchGenerationContext,
  generateMatchPlan,
  MATCH_GENERATION_STRATEGY,
  ROUND_ROBIN_MODE,
} from ".../match-generation/index.js";

const result = generateMatchPlan(request, context);
// result.ok === true → result.matchPlan (logical only)
```

Bound fingerprints on MatchPlan:

- `drawFingerprint`
- `ruleEvaluationFingerprint`
- `participantFingerprint`
- `generationFingerprint`
- `generatorVersion` (`1.0.0-phase1c`)

## Rule consumption (fail closed)

Supports only bound `EvaluatedMatchGenerationRules` for RR strategies:

| Field | Phase 1C |
|-------|----------|
| `roundRobinMode` | `SINGLE` or `DOUBLE` (`CUSTOM` → fail) |
| `encounterCount` | `1` with SINGLE, `2` with DOUBLE |
| `rematchRestrictions` | must be false for DOUBLE |
| `sameClubRestrictions` | must be false |
| `byePolicy` | must be `NONE` (circle bye rotation owns odd-N byes) |
| `formatSpecificConstraints` | must be empty |

No second Rule Engine. Strategy mismatch → `RULE_STRATEGY_MISMATCH`.

## Unsupported strategies

Phase 1C executor rejects (fail closed):

- `SINGLE_ELIMINATION`, `TEAM_FIXTURE` (contract-bound, no executor yet)
- `SWISS`, `DOUBLE_ELIMINATION` (deferred)
- unknown strings

## Tests

```powershell
node --test tests/competition-core-match-generation-core09-phase1b.test.js
node --test tests/competition-core-match-generation-core09-phase1c.test.js
node --test tests/competition-core-match-generation-core09-phase1b.test.js tests/competition-core-match-generation-core09-phase1c.test.js
```

Not added to Integrator `unit-test-files.json` in this phase.

## Known limitations / next phase

- No knockout / Swiss / team-fixture executors
- No scheduling, courts, referees, scoring, standings
- No persistence / SQL / Supabase / UI / production wiring
- No root barrel export
- A/B balancing is circle-local (not a global optimization solver)

## Non-goals (confirmed)

- Production tournament / Daily Play / Team Tournament runtime
- `scheduling/` module changes
- Feature flags ON
- Commit / push / PR / deploy (Owner review gate)
