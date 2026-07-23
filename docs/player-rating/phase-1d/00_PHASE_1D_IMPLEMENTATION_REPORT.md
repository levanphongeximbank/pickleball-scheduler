# Phase 1D — Append-Only History & Immutable Snapshots

**Status:** Implementation complete
**Branch:** `feature/player-rating-phase-1d-history-snapshots`
**Namespace:** `src/features/player-rating/foundation/history-snapshot/`

## Objective

Additive foundation services for append-only Player Rating history and immutable snapshots, plus isolated in-memory port adapters for tests. Phase 1D does **not** persist to SQL/Supabase, mutate current rating, convert scales, select runtime SSOT, or wire Production runtime.

## Surface map

| Surface | Path |
|---------|------|
| Barrel | `foundation/history-snapshot/index.js` |
| History service | `appendRatingHistory.js` |
| Snapshot service | `createRatingSnapshot.js` |
| Deterministic ordering | `ordering.js` |
| Scope matching | `scopeMatch.js` |
| In-memory history adapter | `createInMemoryRatingHistoryAdapter.js` |
| In-memory snapshot adapter | `createInMemoryRatingSnapshotAdapter.js` |
| Foundation re-exports | `foundation/index.js` (export only) |
| Error codes (narrow adds) | `foundation/errors/errorCodes.js` |
| Tests | `tests/player-rating-history-snapshot.test.js` |

## History behavior

- Append validated entries via existing `createRatingHistoryEntryContract`
- Retrieve by `eventId`
- List by canonical `playerId` + explicit scope
- Optional `ratingMode` filter
- Deterministic ascending order: `effectiveAt` → `recordedAt` → `eventId`
- Reject duplicate `eventId` (`HISTORY_ENTRY_DUPLICATE`)
- Reject missing canonical `playerId` / unresolved alias identity
- Reject missing/malformed scope
- Reject update/delete (`HISTORY_MUTATION_FORBIDDEN`)
- Preserve `beforeState`, `afterState`, `effectiveAt`, `recordedAt`
- Deeply immutable stored/read values
- Caller-supplied IDs and timestamps only

## Snapshot behavior

- Create from direct fields, Phase 1B current state, or Phase 1C candidate
- Retrieve by `snapshotId` (optional scope check)
- List by canonical `playerId` + explicit scope
- Optional `ratingMode` filter
- Deterministic ascending order: `effectiveAt` → `createdAt` → `snapshotId`
- Reject duplicate `snapshotId` (`SNAPSHOT_DUPLICATE`)
- Reject missing canonical `playerId` and alias promotion
- Reject update/delete (`SNAPSHOT_MUTATION_FORBIDDEN`)
- Preserve source scale, source metadata, `sourceStateVersion`, timestamps
- Do **not** convert V2↔V5 scales, calculate `displayRating`, or select latest snapshot as current rating
- `authoritativeForPublicPlayerRating` defaults to `false` unless explicitly supplied

## In-memory adapters

- Implement existing `RatingHistoryPort` / `RatingSnapshotPort`
- Each factory call owns isolated Map state
- No global singleton, localStorage, filesystem, or Supabase access
- Foundation/test adapters only — **not** Production persistence

## Errors

Reuses `PlayerRatingFoundationError`. Added narrow codes:

- `PLAYER_RATING_HISTORY_ENTRY_DUPLICATE`
- `PLAYER_RATING_HISTORY_ENTRY_NOT_FOUND`
- `PLAYER_RATING_SNAPSHOT_DUPLICATE`

Also reuses existing `HISTORY_MUTATION_FORBIDDEN`, `SNAPSHOT_MUTATION_FORBIDDEN`, `SNAPSHOT_NOT_FOUND`, `CANONICAL_PLAYER_ID_UNRESOLVED`, `TENANT_OR_SCOPE_UNRESOLVED`, `INVALID_RATING_CONTRACT`.

## Non-goals preserved

No SQL, Supabase, localStorage, generated random IDs, automatic timestamps, scale conversion, current-rating mutation, match-result processing, Competition Engine / Ranking / Player Management / Club / UI wiring. Root `src/features/player-rating/index.js` untouched.

## Open gates (unchanged from Phase 1A/1B/1C)

G-ID-01/02, G-CE-01/02, G-ALG-01, G-MODE-01/02, G-SSOT-01, G-SEC-01, G-PROD-01, G-REV-01, G-BOOTSTRAP-01 remain open.
