# CORE-09 — Contract Defaults, Fail-Closed Enums, and Immutability

**Status:** Phase 1B remediation  
**Production impact:** NONE

## Fail-closed enums

Unknown or invalid **operational** enum values **must not** silently normalize to a valid value (e.g. typo → `ROUND_ROBIN` or `DIRECT_PARTICIPANT`).

Factories throw `MatchGenerationContractError` with deterministic codes:

| Field | On unknown / missing required |
|-------|-------------------------------|
| `MatchGenerationRequest.strategy` | `STRATEGY_REQUIRED` / `STRATEGY_UNSUPPORTED` / `STRATEGY_DEFERRED` |
| `EvaluatedMatchGenerationRules.generationStrategy` | same |
| `roundRobinMode` / `byePolicy` / `bracketSizePolicy` / `thirdPlacePolicy` when **provided** | `INVALID_ENUM_VALUE` |
| `MatchDependency.type` | `INVALID_ENUM_VALUE` (required) |
| `ParticipantSlot.kind` | `INVALID_ENUM_VALUE` (required) |
| `MatchGenerationIssue.code` | `INVALID_ISSUE_CODE` |
| `MatchGenerationIssue.severity` when provided | `INVALID_ENUM_VALUE` |
| `DrawSnapshot.completionStatus` when provided | `INVALID_ENUM_VALUE` (omitted → `INCOMPLETE`) |

Deferred strategies `SWISS` and `DOUBLE_ELIMINATION` remain explicitly unsupported.

`createFixedMatchGenerationRulePort` validates strategy on **raw** input **before** calling `createEvaluatedMatchGenerationRules`.

## Documented optional defaults (omit only)

| Field | Default when omitted |
|-------|----------------------|
| `schemaVersion` | `core09.match-generation.v1` |
| `generatorVersion` | `MATCH_GENERATOR_IDENTITY.version` |
| `categoryId` / `groupId` / `bracketId` | `null` (encoded as optional-absent in LMK) |
| `MatchGenerationIssue.severity` | `ERROR` |
| `roundRobinMode` | `SINGLE` |
| `byePolicy` | `NONE` |
| `bracketSizePolicy` | `POWER_OF_TWO` |
| `thirdPlacePolicy` | `NONE` |
| `encounterCount` | `1` |
| `rematchRestrictions` / `sameClubRestrictions` | `false` |
| `operation` (evaluated rules) | always `MATCHUP` (not caller-selectable) |
| `completionStatus` (Draw) | `INCOMPLETE` (fail-closed toward rejection) |
| empty arrays / `{}` metadata | empty frozen structures |

## Logical match key grammar (`CORE09_LMK_V1`)

Streaming length-prefixed concatenation (no delimiter reliance on ID body):

```text
CORE09_LMK_V1
  + req:<len>:<competitionId>
  + req:<len>:<divisionId>
  + opt:0 | opt:1:<len>:<categoryId>
  + req:<len>:<stageId>
  + opt:0 | opt:1:<len>:<groupId>
  + opt:0 | opt:1:<len>:<bracketId>
  + R:<positiveInt>
  + M:<positiveInt>
```

- IDs may contain `::`, `|`, or the literal text `NONE`.
- Absence ≠ ID `"NONE"` (`opt:0` vs `opt:1:4:NONE`).
- `bracketId` is a structural coordinate for multi-bracket stages.
- `roundNumber` / `matchNumber` must be positive integers (no coerce-to-zero).
- `competitionId`, `divisionId`, `stageId` required non-empty.
- **`drawFingerprint` is not in the key** — bound on MatchPlan / generation context.

## Draw catalog / reference rules

- Non-empty `groupId` on a placement requires a non-empty group catalog containing that id.
- Non-empty `bracketId` requires a non-empty bracket catalog containing that id.
- Empty catalogs are allowed only when no placement references that catalog type.
- Missing / duplicate participant placements fail.
- Version / fingerprint mismatches fail.
- Validation never mutates or repairs Draw data.

## Immutability

- Caller input is not mutated.
- Canonical arrays are copied and `Object.freeze`d.
- Nested metadata / bag objects are **deep-copied and recursively frozen** via `deepFreezeCanonical` / `freezeMetadata`.
- Unsupported values (functions, symbols, bigint, non-finite numbers, cycles) fail closed in canonical / fingerprint material.
- Fingerprinted plans expose frozen arrays/objects; mutation after fingerprint throws in strict mode / fails validation on recompute.

## Fingerprints

- FNV-1a 32-bit remains a **non-security** diagnostic / invalidation checksum.
- SHA-256 (or stronger) remains a **later** recommendation for persistence / cross-system audit integrity.
- No production executor or runtime wiring in Phase 1B.
