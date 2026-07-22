# CORE-10 — Determinism Policy

**Policy id:** `CORE10_DETERMINISM_V1`
**Helpers (capability-local):** `optimizer/deterministic/`
**Ownership:** CORE-10-local implementation. Do not deep-import private fingerprint/PRNG helpers from other COREs.

---

## Hard rules

1. **No `Math.random`** — ambient randomness is forbidden. Missing/invalid seed fails closed.
2. **No `Date.now` / current time / execution timing** in ranking, score comparison, or replay fingerprints.
3. **No `localeCompare`** and no locale-sensitive sorting for deterministic ordering.
4. **No floating-point equality** for ranking — use quantized integers.
5. **No unstable object-key iteration** — canonicalize by sorting keys with the stable string comparator before serialization.
6. **Wall-clock timeout** may exist only as a **safety watchdog**. A timeout-triggered run must **not** be reported as replay-certified success (`WATCHDOG_TIMEOUT`).

---

## Canonical serialization

Algorithm id: `CORE10_CANONICAL_JSON_V1`

1. Validate values are JSON-canonical (no functions, Date, Map, Set, undefined, symbol, bigint, NaN, Infinity, cycles).
2. Sort object keys by **explicit stable string comparator** (UTF-16 code-unit / canonical byte ordering of the key string).
3. Preserve array order unless a contract explicitly requires canonical sorting of that array.
4. Serialize with `JSON.stringify` over the canonicalized structure.
5. Same accepted input ⇒ identical serialized form.

### Number / string policy details

| Topic | Policy |
|-------|--------|
| `-0` | Normalized to `+0` before serialization (matches `JSON.stringify` collapse). |
| Surrogate pairs | Compared and hashed as UTF-16 code units (`charCodeAt`); no special pairing rewrite. |
| Unicode normalization | **No** NFC/NFD rewrite — strings are taken as provided code-unit sequences. |
| Object property ordering | Sorted by stable string comparator; insertion order must not affect output. |
| Array ordering | Preserved as contractual order. |
| Integer boundaries | Replay numbers must be finite; ranking scores must be finite integers (`Number.isInteger`). Prefer string seeds for values outside safe integer identity concerns. |

---

## Fingerprint

| Property | Value |
|----------|-------|
| Algorithm | FNV-1a 32-bit over canonical serialization |
| Version constant | `CORE10_FINGERPRINT_V1` |
| Output | 8-char lowercase hex (unsigned 32-bit) |
| Claim | Deterministic identity / replay checks — **not** cryptographic security |

Fingerprint material always includes `fingerprintAlgorithmVersion`.
Same accepted input ⇒ same fingerprint.
Contractually material differences ⇒ different fingerprints (covered by tests).
`resultFingerprint` material must **not** recursively include the `resultFingerprint` field itself.

---

## Seeded random policy

| Property | Value |
|----------|-------|
| Algorithm | Mulberry32 |
| Version | `CORE10_PRNG_MULBERRY32_V1` |
| Seed | Explicit required non-empty string **or** finite integer (including `0` and negatives); normalized to string then hashed with PRNG version |
| Fallback | **None** — never host ambient RNG |

Same seed + same call sequence ⇒ identical values.
Empty string, `null`, `undefined`, non-integer numbers, and non-string/non-integer types fail closed.
Phase 1B does **not** use the PRNG to generate domain candidates.

---

## Comparator version

Constant: `CORE10_COMPARATOR_V1`

Required comparison order for candidates / scores:

1. Feasible candidates before infeasible candidates.
2. Hard-constraint violations are never compensated by soft scores (`hardViolationCount` ascending; infeasible with more hard violations ranks worse).
3. Structured authority / priority keys when supplied (policy order).
4. Objective keys in declared policy order (respecting `MINIMIZE` / `MAXIMIZE` via stored oriented values).
5. Stable `candidateId` as the **final** tie-break (stable string comparator).

`displayTotal` is display-only and **must not** control ranking.

---

## Integer / quantized scoring

- Objective and violation magnitudes are quantized integers.
- Policy `quantizeScale` is a positive integer documenting the quantization grid.
- Ranking uses integer comparison only.

---

## Stable string / ID comparator

Function: `compareStableString(a, b)`

- Compares UTF-16 code units sequentially (same as canonical byte ordering of the UTF-16 code-unit sequence for BMP-oriented IDs).
- Shorter common-prefix string sorts first when all shared units are equal.
- **Does not** call `localeCompare`.
- Used for: object key sorting, candidate ID tie-break, stable ID ordering.

---

## Deterministic search budgets

Replay-certified budgets use discrete counters such as:

- `maxNodes`
- `maxCandidates`
- `maxEvaluations`

Budget exhaustion ⇒ `BUDGET_EXHAUSTED` (not replay-certified success).
Watchdog wall-clock timeout ⇒ `WATCHDOG_TIMEOUT` (not replay-certified success).

---

## Replay requirements

`ReplayMetadata` must bind:

- engine version
- contract schema version
- policy id + version
- comparator version
- fingerprint algorithm version
- input snapshot fingerprints
- seed + PRNG version when applicable
- operation identifier
- deterministic budget
- result fingerprint

Exclude from replay-determining fingerprints: wall-clock duration, machine identity, timestamps, PID, memory, runtime timing.
