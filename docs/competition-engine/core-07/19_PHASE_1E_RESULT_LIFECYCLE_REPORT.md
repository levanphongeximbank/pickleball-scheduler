# CORE-07 — Phase 1E Result Lifecycle Report

**Phase:** 1E — Result Lifecycle, Finalization and Superseding
**Status:** Implemented (capability-local, non-production) — awaiting Owner commit review
**Baseline HEAD (certified sync):** `52af5d5535fb63e801e54a2ed1c86aa0f32a23c1`
**Contract sources:** docs `07`–`14`, `18`

---

## 1. Objective

Pure, immutable lifecycle services that transform validated `SeedingResult`
documents without mutating caller inputs or reallocating seeds.

Supported states: `DRAFT` | `FINALIZED` | `SUPERSEDED` | `CANCELLED`.

---

## 2. State-transition matrix

| From \ To | DRAFT | FINALIZED | SUPERSEDED | CANCELLED |
|-----------|-------|-----------|------------|-----------|
| **DRAFT** | REJECTED | ALLOWED | REJECTED | ALLOWED |
| **FINALIZED** | REJECTED | IDEMPOTENT_ONLY | ALLOWED | REJECTED |
| **SUPERSEDED** | REJECTED | REJECTED | REJECTED | REJECTED |
| **CANCELLED** | REJECTED | REJECTED | REJECTED | REJECTED |

Notes:

- `IDEMPOTENT_ONLY` is not a new transition; it is a replay of an identical
  finalization identity (see §4).
- `FINALIZED → CANCELLED` is rejected; use superseding (doc 12 §3.4–3.5).
- `DRAFT → SUPERSEDED` is rejected.
- `SUPERSEDED` and `CANCELLED` are terminal.

Implemented by `validateSeedingStateTransition` /
`SEEDING_STATE_TRANSITION_MATRIX`.

---

## 3. Finalization preconditions

`finalizeSeedingResult` allows `DRAFT → FINALIZED` only when:

1. Current state is `DRAFT` (or identical idempotent `FINALIZED` replay).
2. `resultId` matches request.
3. `resultVersion` matches `expectedResultVersion`.
4. `deterministicFingerprint` matches `expectedFingerprint`.
5. `policyProvenance.policyId` / `policyVersion` exist.
6. `snapshotProvenance.snapshotId` exists.
7. Assignments remain positive unique integers with unique `entryId`s.
8. Explicit authorization decision is `ALLOWED` for `FINALIZE`.
9. Authorization scope key matches result scope key.
10. `finalizedAt` is supplied explicitly (no wall-clock reads).
11. Optional repository port reports no conflicting authoritative result.
12. No seed reallocation or fingerprint regeneration occurs.

Success preserves assignments and fingerprint byte-for-byte/logically, sets
`finalizationState=FINALIZED`, records actor/authorization provenance, and
emits a deterministic lifecycle audit event.

---

## 4. Idempotency identity

Repeated finalization is idempotent only when all of the following match:

```text
FINALIZE
| idempotencyKey
| resultId
| resultVersion
| fingerprint
| authorization.decisionId
| actor.id
```

Behaviour:

- Identical accepted request → same logical `FINALIZED` outcome.
- Stable `eventId` is derived from the original `RESULT_FINALIZED`
  identity (`DRAFT→FINALIZED`).
- **`lifecycleEvents`**: logical/historical events associated with the
  outcome (present on first finalize and on replay).
- **`eventsToAppend`**: newly appendable events for *this* invocation only.
  First finalize: length 1. Idempotent replay: **empty**.
- Idempotent replay **does not** invoke `SeedingLifecycleAuditPort.appendLifecycleEvents`.
  CORE-07 owns this guarantee; adapters must not assume silent dedupe.
- Different fingerprint / version → fail closed.
- Different idempotency key or authorization `decisionId` → `RESULT_FINALIZED`
  (non-idempotent).
- No global mutable cache or singleton.

---

## 4.1 Authoritative-result identity rules

`findAuthoritativeByScope` is interpreted by stable identity fields
(`resultId`, `resultVersion`, canonical SeedingScope key, fingerprint when
relevant) — **never** by object reference equality.

### Finalization (`DRAFT → FINALIZED`)

| Repository authoritative result | Behaviour |
|---------------------------------|-----------|
| none | allowed |
| same `resultId` as the result being finalized | allowed (identity match) |
| different FINALIZED `resultId` in the same scope | `AUTHORITATIVE_RESULT_CONFLICT` |
| FINALIZED result whose scope key differs | `AUTHORITATIVE_RESULT_CONFLICT` |

### Superseding

| Repository authoritative result | Behaviour |
|---------------------------------|-----------|
| equals **previous** result (`resultId`) | **expected** — not a conflict |
| equals **replacement** result (`resultId`) | allowed as identity allowance |
| a **third** FINALIZED result in the same scope | `AUTHORITATIVE_RESULT_CONFLICT` |
| FINALIZED result from another scope | fail closed (`AUTHORITATIVE_RESULT_CONFLICT`) |

Why previous is not a conflict: superseding starts while the prior result is
still the sole authoritative FINALIZED document for the scope. Treating that
presence as a conflict would make every supersede fail closed.

A third-result conflict means another authoritative FINALIZED document exists
for the same canonical SeedingScope that is neither the previous nor the
replacement result.

---

## 5. Superseding sequence

1. Validate prior result is `FINALIZED`.
2. Validate replacement result is `FINALIZED`.
3. Validate canonical `SeedingScope` keys match.
4. Require explicit `replacement.supersededResultId === prior.resultId`.
5. Require distinct `resultId` or `resultVersion`.
6. If both versions are finite numbers, require `replacement > prior`;
   otherwise rely on the explicit superseding reference (no lexicographic
   guessing).
7. Clone prior into a new immutable `SUPERSEDED` document.
8. Record `supersededByResultId` + explicit `supersededAt`.
9. Preserve prior assignments and fingerprint unchanged.
10. Emit deterministic audit event; optional repository `saveSuperseded`.

Authoritative invariant: at most one authoritative `FINALIZED` result per
canonical `SeedingScope`. Conflicting repository reports →
`AUTHORITATIVE_RESULT_CONFLICT`.

---

## 6. Cancellation semantics

- `DRAFT → CANCELLED`: allowed with accepted authorization and non-empty reason.
- `FINALIZED → CANCELLED`: rejected (`RESULT_FINALIZED`); supersede instead.
- Terminal states cannot be cancelled again.
- Assignments and fingerprint are preserved unchanged.
- Cancellation is not a substitute for superseding.

---

## 7. Authorization decision

Consumes an explicit decision object:

- `decisionId`, `decision` (`ALLOWED`/`DENIED`/`NOT_EVALUATED`)
- `lifecycleAction` (`FINALIZE`/`SUPERSEDE`/`CANCEL`)
- stable `actor.id`
- `scope` matching result scope
- `authorizationPolicyId` + `authorizationPolicyVersion`

Does **not** query roles, Identity internals, UI, env flags, or Supabase.
Denied / missing / mismatched → `FINALIZATION_UNAUTHORIZED`.

---

## 8. Port boundaries

### SeedingResultRepositoryPort (`core07-result-repository-port-v1`)

Methods: `findByResultId`, `findAuthoritativeByScope`, `saveDraft`,
`saveFinalized`, `saveSuperseded`, `saveCancelled`.

- No implicit memory/Production fallback in CORE-07.
- Exceptions map to `INTERNAL_PORT_FAILURE`.
- Atomicity is an integrator expectation at the persistence boundary.

### SeedingLifecycleAuditPort (`core07-lifecycle-audit-port-v1`)

Method: `appendLifecycleEvents`.

- Caller-supplied or deterministic `eventId`.
- Explicit `occurredAt`.
- No silent failure; invalid output fails closed.
- Exceptions map to `INTERNAL_PORT_FAILURE`.
- **Idempotent finalization replay does not call this port.** Append
  responsibility for replay is owned by CORE-07 (`eventsToAppend=[]`), not by
  unstated infrastructure deduplication.

Phase 1E ships **contracts only** — no Supabase/SQL adapters.

---

## 9. Audit-event model

Fields (where applicable): `eventId`, `eventType`, `resultId`,
`resultVersion`, `seedingScope` / `seedingScopeKey`, `previousState`,
`nextState`, `fingerprint`, `supersededResultId` / `supersededByResultId`,
actor provenance, authorization provenance, explicit `occurredAt`,
`reasonCodes`, `requestId`, `correlationId`, `idempotencyKey`.

No secrets or presentation-only labels.

Event types: `RESULT_FINALIZED`, `RESULT_FINALIZE_IDEMPOTENT`,
`RESULT_SUPERSEDED`, `RESULT_CANCELLED`.

---

## 10. Error / reason-code additions

Reused frozen codes: `INVALID_REQUEST`, `INVALID_SCOPE`, `POLICY_REQUIRED`,
`SNAPSHOT_REQUIRED`, `RESULT_FINALIZED`, `NON_DETERMINISTIC_INPUT`,
`DUPLICATE_SEED_NUMBER`, `INTERNAL_PORT_FAILURE`.

Lifecycle-local additions:

| Code | Meaning |
|------|---------|
| `RESULT_VERSION_MISMATCH` | expectedResultVersion / comparable version conflict |
| `RESULT_FINGERPRINT_MISMATCH` | expectedFingerprint mismatch |
| `INVALID_STATE_TRANSITION` | undefined / forbidden transition |
| `AUTHORITATIVE_RESULT_CONFLICT` | second authoritative FINALIZED for scope |
| `SUPERSEDE_SCOPE_MISMATCH` | replacement scope ≠ prior scope |
| `SUPERSEDE_REFERENCE_REQUIRED` | missing/wrong supersededResultId |
| `FINALIZATION_UNAUTHORIZED` | missing/denied/mismatched auth decision |

---

## 11. Source layout

```text
src/features/competition-core/seeding/domain/
  normalizeLifecycleAuthorizationDecision.js
  normalizeFinalizationRequest.js
  normalizeSupersedeRequest.js
  normalizeCancellationRequest.js
  createLifecycleAuditEvent.js
  cloneSeedingResultWithLifecycle.js

src/features/competition-core/seeding/services/
  validateSeedingStateTransition.js
  finalizeSeedingResult.js
  supersedeSeedingResult.js
  cancelSeedingResult.js
  lifecycleValidation.js          # shared validation helpers (path addition)

src/features/competition-core/seeding/ports/
  SeedingResultRepositoryPort.js
  SeedingLifecycleAuditPort.js
```

**Path deviation:** `lifecycleValidation.js` was added under `services/` for
shared precondition helpers (not listed in the prompt filename set).

Exports: capability-local `seeding/index.js` only. Root barrel unchanged.

---

## 12. Test evidence

File: `tests/competition-core-seeding-core07-phase1e.test.js`
Registered in `scripts/ci/unit-test-files.json`.

Coverage includes:

- Finalization / cancellation / superseding preconditions
- Transition matrix (static + behavioural)
- Idempotent replay: `eventsToAppend.length === 0`, audit append not re-invoked,
  stored audit record count remains 1 after two identical calls
- Authoritative-result identity: no authoritative OK; different conflict;
  previous-as-authoritative OK for supersede; third-result conflict;
  other-scope fail closed; object-reference independence; key-order stability
- Port failure mapping to `INTERNAL_PORT_FAILURE`
- Boundaries and repeat-run determinism

---

## 13. Deferred Phase 1F scope

- Production / staging repository adapters (Supabase) implementing the ports
- SQL migrations for seeding result lifecycle storage
- Integrator orchestration wiring (without activating Production feature flags)
- Shadow-mode observation of finalize/supersede
- Draw (CORE-08) consumption of authoritative FINALIZED results only
- HTTP/API surfaces and UI lifecycle actions
- Background jobs / notifications

---

## 14. Non-goals confirmed

No Production persistence, no SQL/Supabase adapters, no CORE-01/03 infra,
no CORE-08/09 changes, no legacy engine edits, no root export activation,
no feature flags.
