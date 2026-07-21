# CORE-09 Phase 1D — Single Elimination MatchPlan Generation

**Status:** Implemented (capability-local, dormant)
**Module:** `src/features/competition-core/match-generation/`
**Production impact:** NONE

## Ownership

| Concern | Owner |
|---------|-------|
| Participant bracket placement, seed-to-slot, bye recipient selection | CORE-08 Draw |
| Evaluated strategy / bye / bracket / third-place policies | CORE-01 Rule Engine (frozen snapshot) |
| Logical MatchPlan, explicit bye matches, winner/loser dependency graph | CORE-09 |
| Bye auto-advancement, scores, results, lifecycle | Match Lifecycle |
| Court / time / referee | Scheduling |

CORE-09 **must not** select bye recipients from Draw array order, reseed, shuffle, or invent missing bye slots.

## Formulas

For `N` unique non-bye participants:

- `B` = smallest power of two `>= N` when `bracketSizePolicy` is `POWER_OF_TWO` or `NEXT_POWER_OF_TWO` (identical SE semantics; never shrink)
- `EXACT` only when `N` is already a power of two (`B = N`); otherwise fail closed
- `byeCount = B - N`
- `championshipRoundCount = log2(B)`
- Opening matches = `B / 2`
- Without third place: LogicalMatches = `B - 1`; played = `N - 1`
- With `thirdPlacePolicy = PLAYOFF` (`N >= 4`): LogicalMatches = `B`; played = `N`

## Draw-owned bye allocation

DrawSnapshot must provide **exactly `B` canonical bracket slots** with unique `position` values `1..B`:

- Non-bye slots: `participantPlacements` with `participantId` and `position`
- Bye slots: `participantPlacements` with `isBye: true` **and/or** `byePlacements` entries with `position`

`byePolicy` values `TOP_SEEDS`, `BOTTOM_SEEDS`, and `EXPLICIT_PLACEMENTS` mean Draw already applied that policy. CORE-09 only validates slot completeness (`byeCount === B - N`).

When `byeCount > 0`, `byePolicy NONE` fails closed (`UNSUPPORTED_GENERATION_POLICY`).
Missing bye/slot coordinates fail with `DRAW_PLACEMENT_MISSING` (no redundant issue code).

## Explicit bye LogicalMatches

Opening-round bye:

- Slot A/B: one `DIRECT_PARTICIPANT` + one `BYE`
- `isByeMatch: true`
- No fake participant IDs
- No winner, score, result, or lifecycle fields

## Dependency direction

- Later championship slots: `WINNER_OF` prior-round matches
- Sources point `winnerTo` forward to the next championship match
- Dependencies always earlier round → next championship round
- No cycles, orphans, self-refs, or forward-round refs

## Final and third-place coordinates

| Match | `roundNumber` | `matchNumber` | Slots |
|-------|---------------|---------------|-------|
| Championship final | `championshipRoundCount` | `1` | `WINNER_OF` semis (or two `DIRECT` when `N=2`) |
| Third place | `championshipRoundCount` | `2` | `LOSER_OF` the same two semis |

Semifinals set `loserTo` → third-place key when `PLAYOFF`. Third place does not feed another match.

Do **not** identify the final merely as “the only terminal match”.

## N = 2 … 9 examples (no third place)

| N | B | Rounds | Byes | Played | LogicalMatches |
|---|---|--------|------|--------|----------------|
| 2 | 2 | 1 | 0 | 1 | 1 |
| 3 | 4 | 2 | 1 | 2 | 3 |
| 4 | 4 | 2 | 0 | 3 | 3 |
| 5 | 8 | 3 | 3 | 4 | 7 |
| 6 | 8 | 3 | 2 | 5 | 7 |
| 7 | 8 | 3 | 1 | 6 | 7 |
| 8 | 8 | 3 | 0 | 7 | 7 |
| 9 | 16 | 4 | 7 | 8 | 15 |

With third place (`N >= 4`): add one LogicalMatch / one played match.

## Rule binding

Require:

- request + evaluated strategy `SINGLE_ELIMINATION`
- `encounterCount === 1`
- supported `bracketSizePolicy` / `byePolicy`
- `thirdPlacePolicy` `NONE` or `PLAYOFF`
- no consolation beyond optional third place
- empty `formatSpecificConstraints`

Deferred / still unsupported executors: `DOUBLE_ELIMINATION`, `SWISS`, `TEAM_FIXTURE`.

## Deterministic identity

Logical keys: `CORE09_LMK_V1` coordinates (`roundNumber`, `matchNumber`, optional `bracketId`).
Generator version: `1.0.0-phase1d`.
Fingerprints bind Draw / rules / participants / structural projection.

## Explicit non-goals

- Production wiring, root barrel export, UI, SQL, Supabase, feature flags
- Scoring / lifecycle / scheduling / standings
- Double elimination, Swiss, multi-consolation brackets
