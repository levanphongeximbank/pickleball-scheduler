# CORE-06 Phase 1E — Visibility, Deadline, Concurrency & Idempotency Hardening

**Status:** Implemented (capability-local, dormant)  
**Prerequisite:** Phase 1D merged  
**Production impact:** NONE — no TT V6 wiring, SQL, RPC, UI, or feature flags

## Delivered

- Canonical visibility states: `PRIVATE` → `TEAM_VISIBLE` → `OFFICIALS_VISIBLE` → `OPPONENT_VISIBLE` → `PUBLIC`
- Fail-closed `projectLineupForViewer(request)` with redaction metadata
- Injected deadline timestamps + deterministic phase evaluation (`evaluatedAt` / `commandTime` / `policyTime`)
- Optimistic concurrency (`expectedVersion`) with policy-mandatory mode
- Hardened idempotency replay / conflict semantics
- Locked-state mutation guards + correction workflow boundary
- Audit-safe mutation metadata
- Unit tests: `tests/competition-core-lineup-core06-phase1e.test.js`

## Visibility states

| State | Meaning |
|-------|---------|
| `PRIVATE` | Own-team authorized actors only |
| `TEAM_VISIBLE` | Owning team scope; hidden from opponents/public |
| `OFFICIALS_VISIBLE` | Authorized officials; still hidden from opponents/public unless policy widens |
| `OPPONENT_VISIBLE` | Designated opposing team after reveal authorization |
| `PUBLIC` | General competition viewers — **explicit transition required** |

**Rules**

- Monotonic by default (no regression unless `allowsVisibilityRegression`)
- Stage skip only when `allowsVisibilityStageSkip`
- Lifecycle status alone never reveals (`SUBMITTED` ≠ `OPPONENT_VISIBLE`, `LOCKED` ≠ `PUBLIC`)
- Reveal requires policy authorization **and** `revealAt` eligibility when timestamps are injected

## Projection / redaction

`projectLineupForViewer` request fields:

- `lineup`, `viewerActor`, `viewerScope`, `competitionScope`, `relationship`
- `visibilityPolicy` (hardening policy), `revealState`, **`evaluatedAt` (required)**, `source`

Result:

- `visible` / hidden decision
- `permittedFields` / `redactedFields`
- `projectedLineup` (null when hidden)
- machine-readable `reason` + `metadata.code`
- **No** participant identities, slot ordering, or counts when hidden (unless policy explicitly permits count leak)

Fail closed for: missing `evaluatedAt`, unknown viewer role/relationship, cross-tenant, cross-competition.

## Deadline model

Injected timestamps (`createLineupDeadlineTimestamps`):

- `opensAt`, `submitBy`, `lockAt`, `revealAt`
- optional `graceUntil`, `correctionUntil`, `timezone`

Phases: `NOT_OPEN` | `OPEN` | `GRACE_PERIOD` | `CLOSED` | `LOCKED` | `REVEAL_READY`

Evaluation uses **explicit** time only (`evaluatedAt` / `commandTime` / `policyTime` / injected clock). No `Date.now`.

Deadline evaluation **never** auto-publishes, reveals, forfeits, or randomizes. Missing-lineup fallback remains an explicit Phase 1D orchestration decision.

## expectedVersion

- Match → mutation may proceed
- Missing + policy `requiresExpectedVersion` → `LINEUP_EXPECTED_VERSION_REQUIRED`
- Behind current → `LINEUP_STALE_COMMAND`
- Otherwise mismatch → `LINEUP_VERSION_CONFLICT`
- No silent rebase/merge

## Idempotency

Normalized record: key, aggregate identity, command type, payload fingerprint, result fingerprint, actor/source, expected/resulting version, explicit `createdAt`, replay marker.

| Case | Behavior |
|------|----------|
| Same key + aggregate + command + payload | Replay prior result; `replayed: true`; no version bump; no duplicate lifecycle event |
| Same key, different aggregate / command / payload / expectedVersion | `LINEUP_IDEMPOTENCY_CONFLICT` |

In-memory repository / hardened port only — no Production persistence.

## Locked-state & correction

Blocked by default after `LOCKED` / `PUBLISHED`: draft/submit, participant replace, slot reassignment, random overwrite, visibility regression.

**Fail-closed default:** `allowsLockedCorrection()` returns `false`.

Permitted only when:

1. Injected hardening policy explicitly returns `allowsLockedCorrection(...) === true`
2. Authorization port allows OVERRIDE
3. Non-empty correction reason
4. expectedVersion + audit trail (previous/resulting version, actor, source, reason)

Call path: `override` / `correctLockedLineup` → transition(OVERRIDE) → `assertLockedMutationAllowed` (policy gate) → authz → persist.

Phase 1C OVERRIDE compatibility requires callers to inject `allowsLockedCorrection: () => true`. Omitting policy never authorizes correction.

## Deadline precedence

Independent dimensions returned by `evaluateDeadlinePhase`:

| Field | Meaning |
|-------|---------|
| `phase` / `mutationPhase` / `underlyingPhase` | Mutation window (`NOT_OPEN`…`LOCKED`) |
| `revealEligible` | Whether `evaluatedAt >= revealAt` |
| `revealPhase` | `REVEAL_READY` when eligible, else `null` |

Precedence for mutation phase:

1. Before `opensAt` → `NOT_OPEN`
2. At/after `lockAt` → `LOCKED` (wins over grace)
3. Else grace window between `submitBy` and `graceUntil`
4. Else at/after `submitBy` → `CLOSED`
5. Else → `OPEN`

`REVEAL_READY` never replaces `LOCKED`/`CLOSED` in `phase`. Reveal still requires policy authorization + explicit visibility transition. Invalid/missing optional timestamps are ignored (not invented); no automatic publish/reveal/forfeit/randomize.

Production persistence must atomically commit: aggregate version mutation + lifecycle/audit append + idempotency record.

## Audit metadata

Preserved on accepted mutations / visibility transitions:

`tenantId`, `competitionId`, `teamId`, `lineupIdentityKey`, previous/resulting version, `commandType`, actor, source, idempotency key, command/result fingerprints, explicit `evaluatedAt`, reason/correction reason.

Never includes secrets, tokens, or hidden opponent lineup contents.

## Team Tournament V6 parity (reference only — unchanged)

| Topic | TT V6 today | CORE-06 Phase 1E |
|-------|-------------|------------------|
| Opponent hide | `getVisibleLineup` / RPC until matchup published | Visibility states + projection; no implicit status reveal |
| Deadline | Server `lineupLockAt` + `canSaveDraft`/`canSubmit` | Injected timestamps + explicit `evaluatedAt` |
| Lock | State machine blocks captain edits | Locked guards + correction policy |
| Reveal | Publish-driven opponent visibility | Explicit `OPPONENT_VISIBLE`/`PUBLIC` + `revealAt` |
| Concurrency | `expectedVersion` on mutations | Same + stale/required codes |
| Idempotency | Key + payload hash | Key + aggregate + command + fingerprint + expectedVersion context |
| Gaps hardened | Client clock not authz; UI not SoT | Fail-closed projection; no Date.now; mandatory scopes |

**Preserved:** Format owns exact schedules, grace, reveal rights, late-submit, correction rights.  
**Deferred:** Production adapter/cutover, TT writer replacement, SQL/RPC/UI, feature-flag activation.

## Modules

```
src/features/competition-core/lineups/
  contracts/lineupVisibilityState.js
  contracts/lineupDeadlinePhase.js
  contracts/visibilityProjection.js
  contracts/lineupHardeningPolicy.js
  contracts/auditMetadata.js
  contracts/idempotencyRecord.js
  visibility/
  deadlines/
  concurrency/
  repositories/
  services/lockedMutationGuard.js
  services/idempotencyGuard.js
  services/lineupDomainService.js  (hardened)
  errors/runtimeErrorCodes.js      (+ Phase 1E codes)
```

## Reason / error codes (Phase 1E)

`LINEUP_EXPECTED_VERSION_REQUIRED`, `LINEUP_VERSION_CONFLICT`, `LINEUP_STALE_COMMAND`, `LINEUP_ALREADY_LOCKED`, `LINEUP_MUTATION_NOT_ALLOWED`, `LINEUP_VISIBILITY_TRANSITION_NOT_ALLOWED`, `LINEUP_REVEAL_NOT_AUTHORIZED`, `LINEUP_DEADLINE_NOT_OPEN`, `LINEUP_SUBMISSION_DEADLINE_PASSED`, `LINEUP_GRACE_PERIOD_EXPIRED`, `LINEUP_CORRECTION_WINDOW_CLOSED`, `LINEUP_UNKNOWN_VIEWER_SCOPE`, `LINEUP_CROSS_SCOPE_ACCESS_DENIED`, `LINEUP_IDEMPOTENCY_CONFLICT`
