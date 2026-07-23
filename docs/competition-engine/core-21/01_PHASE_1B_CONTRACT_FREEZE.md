# CORE-21 Phase 1B — Contract Freeze

**Status:** Frozen for Phase 1C/1D implementation

**Date:** 2026-07-23

**Base:** Phase 1A audit on `d7081223634bdfbc6dabecaa8cde0ff0a4b3f4d1`

## Frozen version constants

| Constant | Value |
|----------|--------|
| `CORE21_ENGINE_VERSION` | `1.0.0` |
| `CORE21_SEED_ALGORITHM_VERSION` | `CORE21_SEED_NFC_V1` |
| `CORE21_PRNG_VERSION` | `CORE21_PRNG_MULBERRY32_V1` |
| `CORE21_SERIALIZATION_VERSION` | `CORE21_SERIALIZATION_V1` |
| `CORE21_FINGERPRINT_VERSION` | `CORE21_FINGERPRINT_FNV1A32_V1` |
| `CORE21_COMPARATOR_VERSION` | `CORE21_COMPARATOR_UTF16_V1` |
| `CORE21_REPLAY_CONTRACT_VERSION` | `CORE21_REPLAY_V1` |

## Seed contract

- Accept: non-empty string or finite integer after NFC + trim
- Reject: null/undefined, empty, NUL, object/array seeds (`JSON.stringify` hazard)
- Compose fields (order): `seedNamespace`, `purpose`, `tenantId`, `competitionId`, `contextId`, `derivationFingerprint`, `ownerSeed`
- Separator: `\u001f`
- `ownerSeed` required for compose; never invented

## PRNG contract

- `createSeededRandom(seed) → { prngVersion, seed, nextFloat, nextUint32, fork }`
- Hash material: `${CORE21_PRNG_VERSION}:${normalizedSeed}`
- No ambient `Math.random` fallback
- `fork(label)` derives an isolated substream

## Ordering contract

- `compareStableString` / `compareStableId`: UTF-16 code units; no `localeCompare`
- Default nulls policy: `NULLS_LAST`
- Numeric: finite only; `-0` → `+0`
- Does not encode business ranking

## Serialization / fingerprint contract

- Sorted object keys; arrays preserve order
- Reject Date/Map/Set/undefined/symbol/bigint/non-finite/cycles
- Fingerprint includes algorithm version in material

## Replay contract

- `executionMode`: `REPLAY_VERIFY` | `DETERMINISTIC_EXECUTE`
- Ambient clock forbidden; optional `pinnedDomainTime` only
- Mismatch categories: `INPUT` | `SEED` | `ALGORITHM_VERSION` | `RULE_SET` | `SERIALIZATION` | `EVENT_HISTORY` | `OUTPUT` | `ORDERING` | `PRNG_CONSUMPTION`

## Error codes

`SEED_MISSING` · `SEED_INVALID` · `PRNG_INVALID_OPERATION` · `NON_DETERMINISTIC_INPUT` · `ORDERING_CONTRACT_VIOLATION` · `SERIALIZATION_REJECTED` · `REPLAY_INPUT_INVALID` · `REPLAY_VERSION_MISMATCH` · `REPLAY_OUTPUT_MISMATCH` · `EVENT_HISTORY_MISMATCH`

## Explicitly out of Phase 1B–1D

- CORE-07/08/10 adapter migration
- CORE-20 event-history executor
- Root barrel wiring
- SQL / UI / deploy
