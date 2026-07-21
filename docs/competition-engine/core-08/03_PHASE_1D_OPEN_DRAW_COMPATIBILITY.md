# CORE-08 Phase 1D — Open Draw Compatibility

**Status:** Capability-local (dormant). No production cutover.
**Prerequisite:** Phase 1C + branch sync + documentation hygiene
**Canonical placement SSOT:** Phase 3H (`draw-runtime/**`)

## Objective

Close the Team Tournament open grouping compatibility gap:

| Path | Behavior |
|------|----------|
| Legacy TT OFF seeding | deterministic shuffle → **snake** |
| Phase 3H `OPEN_RANDOM_GROUPS` | deterministic shuffle → **round-robin** |

Phase 1D adds a format-neutral composition mode that reuses existing Phase 3H primitives only.

## Selected design

**Option B — Additive canonical mode** `OPEN_SHUFFLED_SNAKE_GROUPS`

Evidence:

* Adapter-only composition would bypass `DrawResolver` validation or import service internals.
* Behavior is generic (not TT-specific).
* Implementation composes `deterministicShuffle` + `placeIntoGroups(getSnakeGroupIndex)`.
* Existing `OPEN_RANDOM_GROUPS` and `SNAKE_GROUPS` meanings are unchanged.

Option A alone was rejected because adapters must not call placement services outside the resolver.

## Deterministic seed contract

Inherited from `OPEN_RANDOM_GROUPS`:

* With `deterministicSeed` / `randomFn` → shuffle then snake.
* Without → identity order then snake (not seedNumber snake).
* Never `Math.random`.

TT adapter certification paths that require a seed still fail closed when seed is missing.

## Team Tournament adapter

| `placementKind` | Mode | Parity |
|-----------------|------|--------|
| `seeded_snake` | `SNAKE_GROUPS` | Semantic (caller-supplied seeds) |
| `open_random` | `OPEN_RANDOM_GROUPS` | Partial (round-robin; 1B path preserved) |
| `open_shuffled_snake` | `OPEN_SHUFFLED_SNAKE_GROUPS` | Semantic with documented differences |

Private pairing / pairing constraints remain fail-closed.

## Mode mapping

| Legacy | Canonical | Status |
|--------|-----------|--------|
| `tt_open_shuffle_snake` | `OPEN_SHUFFLED_SNAKE_GROUPS` | EXACT |
| `open_shuffled_snake` | `OPEN_SHUFFLED_SNAKE_GROUPS` | EXACT |
| `open` / `random` / … | `OPEN_RANDOM_GROUPS` | CONDITIONAL (unchanged) |

## Tests

- `tests/competition-core-draw-runtime-core08-1d.test.js`
- Capability manifest: `scripts/ci/unit-test-files.phase-core08-1d.json`

## Deferred

- Club/unit/host multi-attempt search
- Private pairing
- Root export / official CI / production cutover
- Input fingerprint / ruleset version
