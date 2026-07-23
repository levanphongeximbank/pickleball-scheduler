# Phase 1E — Verification and Manual Adjustment

**Status:** Implementation complete
**Branch:** `feature/player-rating-phase-1e-verification-adjustment`
**Namespace:** `src/features/player-rating/foundation/verification-adjustment/`

## Objective

Additive, runtime-neutral Player Rating verification and manual-adjustment workflows with domain-level actor authorization, optimistic concurrency, idempotent operation identity, append-only history, adjustment audit, and in-memory support adapters for tests. Phase 1E does **not** implement match-result algorithms, scale conversion, SQL/Supabase, UI, or Production runtime wiring.

## Surface map

| Surface | Path |
|---------|------|
| Barrel | `foundation/verification-adjustment/index.js` |
| Constants / capabilities | `constants.js` |
| Actor authorization | `authorizeRatingOperation.js` |
| Operation identity | `createRatingOperationIdentity.js` |
| State helpers | `stateHelpers.js` |
| Verification workflow | `verifyPlayerRating.js` |
| Adjustment workflow | `adjustPlayerRating.js` |
| History/audit builders | `buildEntries.js` |
| In-memory current-state adapter | `createInMemoryRatingCurrentStateAdapter.js` |
| In-memory adjustment-audit adapter | `createInMemoryRatingAdjustmentAuditAdapter.js` |
| Foundation re-exports | `foundation/index.js` (export only) |
| Error codes (narrow adds) | `foundation/errors/errorCodes.js` |
| Tests | `tests/player-rating-verification-adjustment.test.js` |
| CI registry | `scripts/ci/unit-test-files.json` |

## Actor authorization

Caller-supplied domain actor context (not Production Auth/RBAC):

- Required: `actorId`, `actorType`, capabilities/permissions, tenantId **or** explicit global scope, `reason`, `correlationId`, `operationId`, `occurredAt`
- Capabilities: `PLAYER_RATING_VERIFY`, `PLAYER_RATING_ADJUST`
- Fail closed on missing actorId, missing capability, or tenant/scope mismatch
- Client booleans such as `isAdmin` are **not** trusted without the required capability
- No Identity / Auth / RBAC runtime imports

## Verification workflow

`verifyPlayerRating(request, { currentStateAdapter, historyAdapter })`

- Requires existing current state for canonical `playerId` + scope + `ratingMode`
- Requires explicit `verifiedRating` or `verifiedSourceValue` (no calculation)
- Preserves `sourceScale` (rejects incompatible caller-supplied scale)
- Requires `expectedVersion`; rejects stale versions (`RATING_VERSION_CONFLICT`)
- Increments `stateVersion` deterministically (`n → n+1`)
- Builds immutable `beforeState` / `afterState`
- Appends one history entry (`PLAYER_RATING_VERIFIED`)
- Idempotent on `operationId` (replay identical payload; conflict on divergent payload)

## Manual adjustment workflow

`adjustPlayerRating(request, { currentStateAdapter, historyAdapter, auditAdapter })`

**Permitted target fields** (evidence: Phase 1A current-state mutability; display is projection; calculated is system-derived):

- `selfAssessedRating`
- `provisionalRating`
- `verifiedRating`

**Prohibited:** `calculatedRating`, `displayRating`, and any other field (`ADJUSTMENT_FIELD_NOT_ALLOWED`).

Additional rules:

- Explicit resulting `newValue` required (no `+0.2` increments)
- Rejects identity / scope / mode mutation attempts
- Rejects scale mismatch
- Requires `expectedVersion`, `auditId`, reason, correlation, operation identity
- Appends one history entry (`PLAYER_RATING_ADJUSTED`) and one adjustment-audit entry

## In-memory adapters

- Isolated Map state per factory instance
- No global singleton, localStorage, filesystem, or Supabase
- Current-state adapter: immutable reads, compare-and-set, operation ledger for idempotent replay
- Audit adapter: append-only; duplicate `auditId` / `operationId` rejected; deterministic list ordering
- Foundation/test adapters only — **not** Production persistence

## Atomicity and idempotency

1. Validate actor, IDs, scope, mode, reason, timestamps
2. Preflight operation ledger (absent / replay / conflict)
3. Preflight history eventId and audit ids
4. Read current state; validate `expectedVersion`
5. Build before/after, history, audit, result
6. Compare-and-set current state + operation ledger, then append history (and audit for adjustments)

Validation / preflight failures leave all adapters unchanged. Operation identity includes `operationType`, `playerId`, scope, `ratingMode`, and `operationId` — distinct from match-result application identity.

## Errors

Reuses `PlayerRatingFoundationError`. Narrow codes added:

- `PLAYER_RATING_CURRENT_STATE_NOT_FOUND`
- `PLAYER_RATING_VERSION_CONFLICT`
- `PLAYER_RATING_OPERATION_DUPLICATE`
- `PLAYER_RATING_OPERATION_PAYLOAD_CONFLICT`
- `PLAYER_RATING_SCALE_MISMATCH`
- `PLAYER_RATING_ADJUSTMENT_FIELD_NOT_ALLOWED`
- `PLAYER_RATING_ADJUSTMENT_AUDIT_DUPLICATE`

Also reuses `UNAUTHORIZED_VERIFICATION`, `UNAUTHORIZED_MANUAL_ADJUSTMENT`, `CANONICAL_PLAYER_ID_UNRESOLVED`, `TENANT_OR_SCOPE_UNRESOLVED`, `INVALID_RATING_CONTRACT`, `HISTORY_ENTRY_*`, `PORT_OPERATION_UNIMPLEMENTED`.

## Phase 1F dependency readiness

**Verdict: NOT READY**

| Dependency | Status | Evidence |
|------------|--------|----------|
| `MATCH_RESULT_VALIDATED` | Missing as shipped event constant | `docs/player-rating/phase-1a/05_EVENT_PORT_AND_IDEMPOTENCY_CONTRACTS.md` §3.3; `08_EVIDENCE_INDEX_AND_OPEN_GATES.md` G-CE-01 |
| `MATCH_RESULT_INVALIDATED` | Missing as shipped event constant | Same |
| Result revision wire format | Open joint freeze | G-CE-02 |
| Participant → canonical playerId mapping | Open adapter gate | G-ID-01 / G-ID-02 |
| Lifecycle eligibility for rating apply | Not frozen for Player Rating consumer | Competition Core Elo paths are flag-gated signals, not Player Rating SSOT |
| Walkover / withdrawal / abandoned semantics | Not published as Rating dependency contracts | Related CE docs exist (e.g. core-05/07) but are not the required Rating event contracts |

`MatchResultRatingPort` remains unimplemented by design (`MATCH_RESULT_RATING_INTEGRATION_UNAVAILABLE`). Phase 1F must not start until G-CE-01 / G-CE-02 (and identity mapping) close.

## Non-goals preserved

No SQL, Supabase, localStorage, generated random IDs, automatic timestamps, scale conversion, match-result algorithm, Competition Engine / Ranking / Player Management / Club / UI changes, runtime SSOT selection, or Production persistence claims.

## Open gates (unchanged)

G-ID-01/02, G-CE-01/02, G-ALG-01, G-MODE-01/02, G-SSOT-01, G-SEC-01, G-PROD-01, G-REV-01, G-BOOTSTRAP-01 remain open.
