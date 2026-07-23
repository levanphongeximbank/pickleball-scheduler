# CORE-21 Phase 1D — Replay Verification

**Status:** Implemented

**Entry:** `verifyReplay(input, context, observed)`

## Behavior

1. Validate `ReplayInput` + `ReplayContext` (created via contract factories).
2. Compare observed fingerprints / versions against pinned input.
3. Emit structured mismatches by category.
4. Return redaction-safe `ReplayEvidence`.
5. Optionally throw typed error when `observed.throwOnMismatch === true` in `REPLAY_VERIFY` mode.

## What Phase 1D does not do

- Does not re-execute domain solvers
- Does not read CORE-20 durable stores
- Does not invent wall-clock time or random IDs
- Does not claim multi-module atomic replay orchestration

## Integration note

Consumers (future adapters) supply:

- `normalizedInputFingerprint` / `actualOutputFingerprint`
- algorithm / rule-set / serialization / PRNG version observations
- optional `eventHistoryReference` (CORE-20 ids / stream range)

CORE-21 remains the comparison + evidence authority only.
