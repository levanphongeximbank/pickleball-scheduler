# CC-08C — Season / Session Standings Boundary

## Decision

**Season and session standings use materially different data contracts and tie-break semantics.** They must **not** be forced into the tournament group standings engine in CC-08/CC-08C.

## Session standings (`tournament.standings.logic.js`)

| Aspect | Session path | Tournament group canonical |
|--------|--------------|---------------------------|
| Input | Completed session court results | Group entries + finished matches |
| Identity key | Ephemeral team key from player pairs | Stable entry IDs |
| Points | Win 3 / draw 1 / loss 0 | Configurable (default win 2 / loss 1) |
| Tie-break | matchPoints → scoreDiff → pointsFor → won → name | matchPoints → scoreDiff → pointsFor → won + mini-table/H2H/draw-lot |
| Forfeit/BYE | Not modeled | FORFEIT, BYE, walkover policies |
| Qualification | Per-round UI options | `qualifiersCount` on group complete |

**CC-08C action:** No adapter added. `legacy-session-standings` remains **LEGACY_ONLY**. Runtime adapter is not invoked by session builders.

**Accidental interception guard:** Session code does not import `evaluateCanonicalStandingsRuntime`. Flag ON only affects explicit adapter consumers (competition engine STANDINGS type, direct adapter calls).

## Season / league standings (`seasonStandingsEngine.js`)

| Aspect | Season path | Tournament group canonical |
|--------|-------------|---------------------------|
| Input | Match contribution records across league | Single-event group matches |
| Aggregation | Incremental add/subtract contributions | Full recompute |
| Points | League `pointsSystem` (default win 3) | Per-event `pointsConfig` |
| Scope | Player-level season totals | Event/group entry ranks |
| Tie-break | points → wins → losses | Full tie-break pipeline |

**CC-08C action:** No adapter. Document as **future CC-10+ season engine boundary**.

## Shadow parity

Not attempted for season/session — mapping would change business rules.

## Future phase recommendation

1. **CC-10 Session adapter** — new scope `STANDINGS_SCOPE.SESSION`, dedicated 3/1/0 scoring rule, team-key normalization.
2. **CC-10+ Season engine** — incremental contribution model, separate from event group calculator.

## Verification

- `CC08C-13` — session path legacy-only, adapter preserves legacy output
- `CC08C-15` — season consumer not switched to canonical-primary
