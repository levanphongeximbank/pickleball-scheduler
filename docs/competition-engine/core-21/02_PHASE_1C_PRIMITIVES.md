# CORE-21 Phase 1C — Deterministic Primitives

**Status:** Implemented

**Module:** `src/features/competition-core/deterministic-seed-replay/`

## Delivered

| Area | Entry |
|------|--------|
| Seed normalize / compose / identity | `seed/` |
| Seeded Mulberry32 + fork | `random/createSeededRandom` |
| Stable ordering | `ordering/` |
| Canonicalize / serialize | `serialize/` |
| FNV-1a fingerprint | `fingerprint/` |
| Typed errors | `errors/` |

## Design references (not deep-imported)

- CORE-10 `optimizer/deterministic/*` (versioned PRNG + canonicalize)
- CORE-06 `lineups/random/seed.js` (NFC + field composition)
- CORE-07 ordering docs (identity tie-break policy)

## Tests

`tests/competition-core-deterministic-seed-replay-core21.test.js` — seed, PRNG, ordering, serialization, fingerprint, ambient-scanner.

## Non-claims

- Does not rewrite CORE-07–11 algorithms
- Does not claim cryptographic strength for fingerprints
- Does not migrate existing module PRNG streams (version deliberately differs from CORE-10)
