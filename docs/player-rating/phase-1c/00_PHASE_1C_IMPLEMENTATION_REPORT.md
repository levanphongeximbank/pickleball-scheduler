# Phase 1C — Canonical Current-State Read Model

**Status:** Implementation complete
**Branch:** `feature/player-rating-phase-1c-current-state-read-model`
**Namespace:** `src/features/player-rating/foundation/read-model/`

## Objective

Additive, read-only normalization of existing V2 / V5 / legacy-compatible rating records into immutable canonical current-state **candidates**. Phase 1C does **not** select a runtime SSOT, convert scales, write data, or wire Production runtime.

## Surface map

| Surface | Path |
|---------|------|
| Barrel | `foundation/read-model/index.js` |
| Source classifications | `sourceTypes.js` |
| Candidate DTO | `currentStateCandidate.js` |
| V2 adapter | `normalizeV2Rating.js` |
| V5 adapter | `normalizeV5Rating.js` |
| Legacy adapter | `normalizeLegacyRating.js` |
| Multi-source collector | `collectRatingCandidates.js` |
| Read-model errors | `ratingReadModelErrors.js` |
| Foundation re-exports | `foundation/index.js` (export only) |
| Tests | `tests/player-rating-current-state-read-model.test.js` |

## Canonical candidate fields

`candidateId`, `playerId`, `playerIdResolutionStatus`, `sourceType`, `sourceRecordId`, `sourceScale`, `ratingMode`, `selfAssessedRating`, `provisionalRating`, `verifiedRating`, `calculatedRating`, `displayRating`, `confidence`, `confidenceScale`, `status`, `effectiveAt`, `algorithmVersion`, `tenantId`, `scope`, `aliases`, `warnings`, `rawSourceMetadata`, `authoritativeForPublicPlayerRating`.

Identity rules:

- `playerId` remains opaque and is set only when explicitly supplied as canonical.
- `auth_user_id` and V5 `profiles.id` / `player_id` homonym stay aliases.
- Missing canonical id is never invented.

## Normalization behavior

| Source | Scale preserved | Notes |
|--------|-----------------|-------|
| `PICK_VN_V2` | `PICK_VN_V2_1_0_TO_8_0` | No conversion to 1.5–6.0; history refs preserved in metadata |
| `PICK_VN_V5` | `PICK_VN_V5_1_5_TO_6_0` | Table not declared SSOT; reliability as confidence 0–100 |
| Legacy assessment / player field | `UNKNOWN` unless proven | Marked `LEGACY_NON_AUTHORITATIVE` |
| Competition Elo / Club mirror | classified only | Rejected as non-authoritative signals |

## Collector behavior

`collectRatingCandidates` returns candidates, rejected records, warnings, identity/scale/mode conflicts, and source summary.

- No winner selection, merge, average, or scale conversion.
- Deterministic sort by identity → sourceType → ratingMode → sourceRecordId → candidateId.
- Exact duplicate `candidateId` fingerprints may be de-duplicated.
- Distinct payloads sharing one `candidateId` fail closed (`CANDIDATE_IDENTITY_COLLISION`).
- Distinct resolved canonical `playerId`s in one collection fail closed (`CANONICAL_PLAYER_ID_CONFLICT`).

## Errors

Reuses Phase 1B `PlayerRatingFoundationError` and scope/contract codes. Adds narrow read-model codes:

- `PLAYER_RATING_UNSUPPORTED_SOURCE_TYPE`
- `PLAYER_RATING_INVALID_SOURCE_RECORD`
- `PLAYER_RATING_AMBIGUOUS_SOURCE_SCALE`
- `PLAYER_RATING_CANONICAL_PLAYER_ID_CONFLICT`
- `PLAYER_RATING_CANDIDATE_IDENTITY_COLLISION`
- `PLAYER_RATING_ALIAS_TREATED_AS_CANONICAL`

## Non-goals preserved

No SQL, Supabase access, scale conversion, runtime SSOT selection, match-result algorithm, Competition Engine / Ranking / Player Management / Club / UI wiring. Root `src/features/player-rating/index.js` untouched.

## Open gates (unchanged from Phase 1A/1B)

G-ID-01/02, G-CE-01/02, G-ALG-01, G-MODE-01/02, G-SSOT-01, G-SEC-01, G-PROD-01, G-REV-01, G-BOOTSTRAP-01 remain open.
