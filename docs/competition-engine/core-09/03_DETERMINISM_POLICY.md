# CORE-09 — Determinism Policy

**Policy id:** `CORE09_DETERMINISM_V1`  
**Helpers:** `services/fingerprint.js`, `services/determinismPolicy.js`, `services/buildLogicalMatchKey.js`

## Hard rules

1. **No `Math.random`** in CORE-09 match-generation modules.
2. **No `Date.now`** in stable logical match keys or generation fingerprints.
3. **No random UUID** in logical identity (`logicalMatchKey`).
4. **No locale-dependent ordering** (use ASCII / code-unit compare; no `localeCompare`).
5. **No database-return-order assumptions** — callers must supply deterministic ordering inputs.
6. **No mutable shared generation state** across generation calls.
7. **No unstable object-key iteration assumptions** — canonicalize by sorting keys before fingerprint.
8. **No silent reordering by soft constraints** without fingerprint impact.

## Identical canonical inputs must generate identical

- match count
- stage structure
- round structure
- pairing
- participant slots
- byes
- dependency graph
- logical match keys
- match ordering
- generation fingerprint

## Stable logical keys

Grammar: **`CORE09_LMK_V1`** length-prefixed streaming encoding (see `07_CONTRACT_DEFAULTS_AND_IMMUTABILITY.md`).

- Optional absence is `opt:0` — never a sentinel ID such as `NONE`.
- Includes `bracketId` when present (multi-bracket stages).
- Positive integer `roundNumber` / `matchNumber` only.
- `drawFingerprint` binds at MatchPlan / generation context, **not** inside each key.

Helper: `buildLogicalMatchKey` / `parseLogicalMatchKey`.

## Fingerprints

| Fingerprint | Bound on |
|-------------|----------|
| `drawFingerprint` | DrawSnapshot → MatchPlan |
| `ruleEvaluationFingerprint` | EvaluatedMatchGenerationRules → MatchPlan |
| `participantFingerprint` | Participant snapshot → MatchPlan |
| `generationFingerprint` | Canonical structural projection of MatchPlan + bound fingerprints + generator version |

Algorithm: FNV-1a 32-bit over canonical JSON (sorted object keys). **Not a cryptographic or security-integrity claim.** Prefer SHA-256 in a later persistence / audit phase.

## Generator identity

```text
id: CORE09_MATCH_GENERATOR
version: 1.0.0-phase1b
```

Bump `MATCH_GENERATOR_IDENTITY.version` when stable key derivation or fingerprint material changes.
