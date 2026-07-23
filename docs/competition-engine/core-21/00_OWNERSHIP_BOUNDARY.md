# CORE-21 — Ownership Boundary

**Capability:** Deterministic Seed & Replay

**Module root:** `src/features/competition-core/deterministic-seed-replay/`

**Engine id:** `competition-core.deterministic-seed-replay`

**Engine version:** `1.0.0`

## Owns

| Concern | Notes |
|---------|--------|
| Seed identity | NFC + trim; string/integer only; compose via unit separator |
| Seeded PRNG | Mulberry32; version `CORE21_PRNG_MULBERRY32_V1` mixed into hash |
| Ordering primitives | UTF-16 code-unit compare; nullable policy; key tuples |
| Serialization | Strict canonicalize; reject Date/Map/Set/undefined/non-finite/cycles |
| Fingerprint | Versioned FNV-1a 32-bit (identity, not security) |
| Replay contracts | Input, context, mismatch categories, evidence |
| Replay verification | Compare pinned vs observed fingerprints/versions |
| Typed errors | `DETERMINISTIC_SEED_REPLAY_*` |

## Does not own

| Concern | Owner |
|---------|--------|
| Seeding ranking / seed numbers | CORE-07 |
| Draw / grouping algorithms | CORE-08 |
| Match structure generators | CORE-09 |
| Optimizer search / objectives | CORE-10 |
| Schedule placement | CORE-11 |
| Rule-set content | CORE-01 |
| Audit persistence / taxonomy | CORE-20 |
| Workflow orchestration | CORE-19 |
| Import/export transport | CORE-22 |
| Recovery | CORE-23 |
| UI / SQL / deploy | out of scope |
| Root barrel re-exports | integrator |

## Boundary rule

Modules call CORE-21 via the public `index.js` surface only. CORE-21 never imports private business solvers from CORE-07–11.
