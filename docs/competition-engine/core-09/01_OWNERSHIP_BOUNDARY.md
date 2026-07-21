# CORE-09 — Ownership Boundary

**Module:** `src/features/competition-core/match-generation/`  
**Capability-local public surface:** `match-generation/index.js`  
**Protected:** root `competition-core/index.js`, `unit-test-files.json` (Integrator-owned)

---

## 1. CORE-09 owns

- Transforming approved Draw placements into a logical `MatchPlan`
- Executing an approved `MatchGenerationStrategy` (Phase 1C: `ROUND_ROBIN`, `GROUP_ROUND_ROBIN`; knockout/team later)
- Logical stage and round structure
- Logical match ordering
- Stable logical match keys
- Participant slots
- Explicit bye representation
- Winner and loser dependency edges
- Deterministic regeneration
- Idempotency (policy + fingerprints; runtime wiring later)
- Match-plan validation
- Generation fingerprint

---

## 2. CORE-09 does not own

| Concern | Owner |
|---------|-------|
| Registration / eligibility / entry | CORE-02 / CORE-03 |
| Team roster / lineup submission | CORE-05 / CORE-06 |
| Seeding | Seeding / CORE-08 upstream |
| Draw execution / shuffle / bye selection | CORE-08 (draw / draw-runtime) |
| Schedule date / time / court / referee | Historical scheduling / CC-09 scheduling module |
| Match lifecycle / score / result | Match runtime (Phase 3F+) |
| Standings | Standings module |
| Notifications / UI / persistence implementation | Product / Integrator |
| Partner formation / matchmaking algorithms | `formation/` / `matchmaking/` |

CORE-09 may **consume** approved formation or pairing outputs but must **not** re-own formation or partner-selection logic.

---

## 3. Namespace separation

```text
competition-core/
  match-generation/   ← CORE-09 (this module)
  draw-runtime/       ← CORE-08 substrate (Draw inputs)
  scheduling/         ← historical CC-09 scheduling — NOT Match Generator
  matches/            ← match runtime resolve (not plan generation)
  formation/          ← outside CORE-09
  matchmaking/        ← outside CORE-09
```

---

## 4. Anti-patterns

- Placing Match Generator code under `scheduling/`
- Writing `scheduledAt`, `courtId`, `refereeId`, `score`, or live status onto `LogicalMatch` / `MatchPlan`
- Rerunning Draw, shuffling placements, or reassigning byes inside CORE-09
- Implementing a second Rule Engine inside CORE-09
- Moving Team Tournament lineup/time logic into CORE-09
- Treating Daily Play session matchmaking as CORE-09 ownership without Owner decision

---

## 5. Future integration conditions

Any Production wiring requires Owner approval covering:

1. Executor strategy cutover order (RR → knockout → team fixture)
2. Dual-write vs cutover vs shadow parity
3. Persistence ownership for MatchPlan
4. Feature-flag / kill-switch gates
5. Explicit non-regression of scheduling and score paths
