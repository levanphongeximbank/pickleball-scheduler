# CC-04E — Random Parity

**Phase:** CC-04E

## Requirements verified

- Same injected `randomFn` + same payload → same group membership (open draw)
- Adapter does not call `randomFn` more than legacy within a **single** adapter invocation
- `cloneLegacyDrawPayload()` preserves `randomFn` and `Map` (`playersById`)
- No supplemental `Math.random` in adapter layer

## Limitation

Legacy open draw uses internal retry loops — total `randomFn` call count depends on constraint repair attempts. Shadow comparison (`runDrawShadowComparison`) doubles executor calls by design.

## Tests

- `adapter does not add extra randomFn calls for open draw`
- `official open draw shadow membership parity with injected randomFn`

## Non-deterministic paths

Heuristic retry engines without injected seed are documented as non-replayable — adapter does not assume deterministic replay.
