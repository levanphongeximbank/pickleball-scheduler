# Phase 1I — Security, Privacy, and Boundary Hardening

**Status:** Implementation complete
**Branch:** `feature/player-rating-phase-1i-security-privacy`
**Namespace:** `src/features/player-rating/foundation/security-privacy/`

## Objective

Additive, runtime-neutral Player Rating security and privacy hardening: public and restricted projectors, explicit field-level privacy policy, tenant/scope access validation, capability checks for sensitive reads, redaction of internal confidence/deviation/evidence/actor/audit/raw metadata, and a secure read wrapper around the Phase 1H facade. Phase 1I does **not** add SQL/RLS, wire Production Auth/RBAC, modify UI, select a runtime SSOT, convert scales, process match results, or change Competition Engine / Player Management / Ranking / Club.

## Surface map

| Surface | Path |
|---------|------|
| Barrel | `foundation/security-privacy/index.js` |
| Projection levels / capabilities | `privacyProjectionLevels.js` |
| Privacy policy | `createPlayerRatingPrivacyPolicy.js` |
| Scope access validation | `validatePlayerRatingScopeAccess.js` |
| Read authorization | `authorizePlayerRatingRead.js` |
| Candidate redaction | `redactPlayerRatingCandidate.js` |
| Overview redaction | `redactPlayerRatingOverview.js` |
| Public projector | `projectPublicPlayerRating.js` |
| Restricted projector | `projectRestrictedPlayerRating.js` |
| Secure facade wrapper | `createSecurePlayerRatingReadFacade.js` |
| Error helpers | `securityPrivacyErrors.js` |
| Foundation re-exports | `foundation/index.js` (export only) |
| Error codes (narrow adds) | `foundation/errors/errorCodes.js` |
| Tests | `tests/player-rating-security-privacy.test.js` |
| CI registry | `scripts/ci/unit-test-files.json` |

## Privacy levels

Caller-supplied domain projection levels (not UI role labels):

- `PUBLIC`
- `PLAYER_SELF`
- `AUTHORIZED_REVIEWER`
- `INTERNAL_SYSTEM`

Required access-context fields: `actorId`, `capabilities`, `tenantId` **or** explicit `globalScope`, `projectionLevel`, `subjectPlayerId`, `correlationId`.

Read capabilities:

- `PLAYER_RATING_READ_PUBLIC`
- `PLAYER_RATING_READ_SELF`
- `PLAYER_RATING_READ_RESTRICTED`
- `PLAYER_RATING_READ_INTERNAL`
- `PLAYER_RATING_READ_GLOBAL` (required for global subject scope)

## Projection behavior

### PUBLIC

Allowlist-only safe rating fields (`displayRating` when present — **no substitution**, `verifiedRating` only when policy `exposePublicVerifiedRating`, public warnings, availability, source classification/scale). Removes confidence, reliability, deviation, evidence, aliases, rawSourceMetadata, actor/audit/operation metadata, and history/snapshot ledgers.

### PLAYER_SELF

Requires `PLAYER_RATING_READ_SELF`, matching tenant/scope, and `subjectMappingConfirmed` with `mappedSubjectPlayerId === subjectPlayerId`. Exposes public fields plus own self-assessed / provisional / verified values, optional confidence summary when policy permits, and history/snapshot **summaries** without full audit ledger or server operation metadata. Reviewer evidence / raw internals remain hidden by default.

### AUTHORIZED_REVIEWER

Requires `PLAYER_RATING_READ_RESTRICTED` and explicit tenant/scope match. Exposes operational candidate details, confidence, limited review metrics (extracted from raw metadata — not the raw blob), history with limited actor/reason, and snapshots. Still redacts unrelated profile fields, secrets, correlation/operation ids, and full `rawSourceMetadata`.

### INTERNAL_SYSTEM

Requires `PLAYER_RATING_READ_INTERNAL` and `trustedServerContext === true`. Client `isAdmin` alone is rejected. Retains full rating-domain DTO while stripping unrelated Player Management profile keys (`email`, `phone`, tokens, etc.). Not a Production authorization implementation.

## Secure read facade

`createSecurePlayerRatingReadFacade({ readFacade, privacyPolicy })` exposes **only**:

- `getPublicOverview(input, accessContext)`
- `getSelfOverview(input, accessContext)`
- `getReviewerOverview(input, accessContext)`
- `getInternalOverview(input, accessContext)`

Every method requires access context. Phase 1H facade files are unchanged; projection runs after overview collection. No write API, no scale conversion, no winner selection, no runtime SSOT selection.

## Errors added

Reuse `PlayerRatingFoundationError`. Narrow codes:

- `PLAYER_RATING_READ_UNAUTHORIZED`
- `PLAYER_RATING_PROJECTION_LEVEL_UNSUPPORTED`
- `PLAYER_RATING_SUBJECT_MISMATCH`
- `PLAYER_RATING_TENANT_ACCESS_DENIED`
- `PLAYER_RATING_GLOBAL_SCOPE_DENIED`
- `PLAYER_RATING_PRIVATE_FIELD_EXPOSURE_BLOCKED`

Error details are sanitized to avoid restricted raw payloads.

## Fail-closed tenant / scope rules

- Missing tenant without explicit global scope → deny
- Actor tenant ≠ subject tenant → `RATING_TENANT_ACCESS_DENIED`
- Global subject scope without actor global scope + `PLAYER_RATING_READ_GLOBAL` → `RATING_GLOBAL_SCOPE_DENIED`
- No silent fallback from tenant → global
- Unconfirmed self mapping / subject mismatch → `RATING_SUBJECT_MISMATCH`

## Determinism and immutability

- New immutable outputs via `clonePlain` + `deepFreeze`
- Deterministic key ordering on candidate projections
- No `Date.now`, `Math.random`, or UUID generation
- Source objects are never mutated

## Phase 1F dependency readiness (recheck on fresh `origin/main`)

**Verdict: NOT READY**

| Dependency | Status | Evidence |
|------------|--------|----------|
| Validated result contract (`MATCH_RESULT_VALIDATED`) | Missing as shipped event constant | `docs/player-rating/phase-1a/05_EVENT_PORT_AND_IDEMPOTENCY_CONTRACTS.md` §3.1; `08_EVIDENCE_INDEX_AND_OPEN_GATES.md` G-CE-01; repo search under `src/features/competition-core` finds no symbol |
| Invalidated result contract (`MATCH_RESULT_INVALIDATED`) | Missing as shipped event constant | Same §3.2 / G-CE-01 |
| Result revision wire format | Open joint freeze | G-CE-02; Phase 1A §4 `result_revision` |
| Canonical participant → playerId mapping | Open adapter gate | G-ID-01 / G-ID-02 in `08_EVIDENCE_INDEX_AND_OPEN_GATES.md` |
| Lifecycle rating eligibility | Competition Core Elo paths exist but are not Player Rating SSOT contracts | `src/features/competition-core/rating/isMatchRatingEligible.js` |
| Walkover / withdrawal / abandoned semantics | Present in match/standings surfaces; not published as Rating event dependency contracts | e.g. `competition-core/matches`, `rating/ratingConstants.js`, standings walkover scoring |

Do **not** start Phase 1F until G-CE-01 / G-CE-02 and identity mapping close.

## Non-goals confirmed

- No SQL / RLS / Supabase / localStorage
- No Auth/RBAC runtime imports
- No UI, routes, feature flags, or Production wiring
- No Competition Engine, Player Management, Ranking, or Club changes
- No scale conversion, winner selection, runtime SSOT selection, or display-rating calculation
- No verification/adjustment writes or match-result processing
- Phase 1H `read-facade/**` unchanged
