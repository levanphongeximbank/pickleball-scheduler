# Phase 1H — Read-Only Player Rating Facade

**Status:** Implementation complete
**Branch:** `feature/player-rating-phase-1h-read-facade`
**Namespace:** `src/features/player-rating/foundation/read-facade/`

## Objective

Additive, runtime-neutral read-only Player Rating facade that composes Phase 1C candidate collection with Phase 1D history and snapshot reads into one stable API and one immutable overview DTO. Phase 1H does **not** select a preferred candidate, declare a runtime SSOT, convert scales, calculate display ratings, write current state, verify/adjust, ingest match results, access Supabase, or wire UI/Production runtime.

## Surface map

| Surface | Path |
|---------|------|
| Barrel | `foundation/read-facade/index.js` |
| Factory | `createPlayerRatingReadFacade.js` |
| Overview builder | `buildPlayerRatingOverview.js` |
| Availability statuses | `readFacadeStatus.js` |
| Error helpers | `readFacadeErrors.js` |
| Foundation re-exports | `foundation/index.js` (export only) |
| Tests | `tests/player-rating-read-facade.test.js` |
| CI registry | `scripts/ci/unit-test-files.json` |

## Public API

`createPlayerRatingReadFacade({ historyPort, snapshotPort })` returns a frozen object exposing **only**:

- `collectCandidates(sourceRecords, options)`
- `getCandidate(candidateId, sourceRecords, options)`
- `listCandidates(sourceRecords, options)`
- `listHistory({ playerId, scope, ratingMode })`
- `getHistoryEntry(eventId)`
- `listSnapshots({ playerId, scope, ratingMode })`
- `getSnapshot(snapshotId)`
- `getPlayerRatingOverview(input)`

Required read port methods (fail-closed if missing):

- `historyPort.listHistory`, `historyPort.getHistoryEntry`
- `snapshotPort.getSnapshot`, `snapshotPort.listSnapshots`

No write methods are exposed (`verify`, `adjust`, `update`, `save`, `append`, `createSnapshot`, `delete`, `applyResult`, `reverseResult`).

## Overview DTO

Immutable overview fields:

- `playerId`, `playerIdResolutionStatus`, `scope`, `ratingMode`
- `candidates`, `candidateCount`
- `history`, `historyCount`
- `snapshots`, `snapshotCount`
- `identityConflicts`, `scaleConflicts`, `modeConflicts`
- `rejectedRecords`, `warnings`, `sourceSummary`
- `availabilityStatus`

Availability statuses:

- `AVAILABLE`
- `NO_RATING_DATA`
- `PARTIAL_DATA`
- `IDENTITY_CONFLICT`
- `INVALID_REQUEST` (reserved constant; invalid requests fail closed via typed errors)

## Composition rules

- Reuses Phase 1C `collectRatingCandidates` (ordering, conflicts, rejected records, source summary)
- Reuses Phase 1D history/snapshot adapters and deterministic ordering
- Reuses `requireExplicitPlayerRatingScope`, `requireSupportedRatingMode`, `deepFreeze`, `clonePlain`
- Reuses `PlayerRatingFoundationError` and existing codes — **no new error codes**
- Does not promote aliases to canonical `playerId`
- Does not hide conflicts or discarded rejected records

## Fail-closed behavior

- Missing/malformed scope → `PLAYER_RATING_TENANT_OR_SCOPE_UNRESOLVED`
- Invalid/missing canonical `playerId` where required → `PLAYER_RATING_CANONICAL_PLAYER_ID_UNRESOLVED`
- Conflicting resolved canonical playerIds (default) → `PLAYER_RATING_CANONICAL_PLAYER_ID_CONFLICT`
- Unsupported rating mode → `PLAYER_RATING_UNSUPPORTED_MODE`
- Ports missing required read ops → `PLAYER_RATING_PORT_OPERATION_UNIMPLEMENTED`

`failClosedOnIdentityConflict: false` allows overview to return `IDENTITY_CONFLICT` with conflict details visible.

## Determinism and privacy

- No `Date.now`, `Math.random`, or generated UUIDs
- No global mutable state
- Deeply immutable outputs
- No unrelated raw player-profile fields beyond Phase 1C rating metadata

## Phase 1F dependency readiness (recheck on fresh `origin/main`)

**Verdict: NOT READY**

| Dependency | Status | Evidence |
|------------|--------|----------|
| Validated result contract (`MATCH_RESULT_VALIDATED`) | Missing as shipped event constant | `docs/player-rating/phase-1a/05_EVENT_PORT_AND_IDEMPOTENCY_CONTRACTS.md` §3.1; `08_EVIDENCE_INDEX_AND_OPEN_GATES.md` G-CE-01 |
| Invalidated result contract (`MATCH_RESULT_INVALIDATED`) | Missing as shipped event constant | Same §3.2 / G-CE-01 |
| Result revision wire format | Open joint freeze | G-CE-02; Phase 1A §4 `result_revision` |
| Canonical participant → playerId mapping | Open adapter gate | G-ID-01 / G-ID-02 in `08_EVIDENCE_INDEX_AND_OPEN_GATES.md` |
| Lifecycle rating eligibility | Competition Core Elo paths exist but are not Player Rating SSOT contracts | `src/features/competition-core/rating/isMatchRatingEligible.js` |
| Walkover / withdrawal / abandoned semantics | Present in match/standings surfaces; not published as Rating event dependency contracts | e.g. `competition-core/matches`, `ratingConstants.js` |

Do **not** start Phase 1F until G-CE-01 / G-CE-02 and identity mapping close.

## Non-goals confirmed

- No SQL / Supabase / localStorage
- No UI, routes, feature flags, or Production wiring
- No Competition Engine, Player Management, Ranking, or Club changes
- No scale conversion, winner selection, or runtime SSOT selection
- No verification/adjustment writes, result ingestion, or rating algorithms
