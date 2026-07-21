# CORE-08 Phase 1B — Adapter Certification

**Status:** Capability-local (dormant). No production cutover.
**Prerequisite:** Phase 1A `READY_WITH_ADAPTER_REQUIRED`
**Canonical runtime:** `src/features/competition-core/draw-runtime/**` (Phase 3H)
**Orchestration API:** `createDrawResolver(options).resolve(request)`

## Objective

Certify bounded adapters from legacy / format draw paths to Phase 3H. Mapping and delegation only. No new placement engine.

## Adapter surface

| Target | Symbol | Parity |
|--------|--------|--------|
| A Seeded grouping | `runSeededGroupingAdapter` | `SEMANTIC_PARITY_WITH_DOCUMENTED_DIFFERENCES` |
| B Open conditional | `runOpenConditionalAdapter` | Structural open: documented differences; format conditions → fail closed |
| C Team Tournament | `runTeamTournamentGroupingAdapter` | Seeded snake: semantic; open: `PARTIAL_PARITY` |
| D Constraints | `runConstraintGroupingAdapter` | Empty constraints: partial; non-empty → `HARDENING_REQUIRED` |
| E CC-04 bridge | `runCc04CompatibilityBridge` | Facade default; optional delegate bypass |

## Mode mapping

See `adapters/modeMapping.js` (`LEGACY_TO_PHASE3H_MODE_MATRIX`).

Statuses: `EXACT` | `CONDITIONAL` | `FORMAT_SPECIFIC` | `AMBIGUOUS` | `UNSUPPORTED`.

Ambiguous / unsupported / bare `team` modes return typed `DRAW_CERTIFICATION_ERROR_CODE` — never a silent default.

## What CORE-08 does not claim

- Club/unit/host/visitor open-conditional penalty search
- `avoid_same_group` repair (`assignGroupsWithConstraints`)
- TT private pairing candidate search
- Seed / rating calculation
- CC-04 `evaluateCanonicalDraw` rewiring
- Root export / official CI / feature-flag cutover

## Tests

- `tests/competition-core-draw-runtime-core08-1b.test.js`
- Capability manifest: `scripts/ci/unit-test-files.phase-core08-1b.json`

## Production safety

| Gate | Status |
|------|--------|
| Production callers switched | NONE |
| Feature flags | unchanged (DRAW_V2 remains off) |
| Phase 3H algorithms modified | NO |
| Legacy engines deleted | NO |
| UI / SQL / deploy | NONE |
