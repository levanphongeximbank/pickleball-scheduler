# CORE-03 Phase 1E — Sibling Core Adapters

**Wave:** 1 / CORE-03
**Phase:** 1E — Sibling Core Adapters
**Module:** `src/features/competition-core/registration-eligibility/adapters/`
**Branch intent:** `feature/competition-core-03-sibling-adapters`
**Adapter composition version:** `SIBLING_ADAPTERS_VERSION` = `core03-sibling-adapters-1.0.0`

---

## 1. Adapter architecture

Phase 1E adds a Core-03-owned adapter layer that implements existing Core-03 ports by normalizing **injected** sibling public facades:

```text
Core-03 ports  ←  adapters/**  ←  injected sibling public facades
```

Composition factory:

```js
import {
  createCore03SiblingAdapters,
  createFakeSiblingFacades,
} from "../registration-eligibility/index.js";

const facades = createFakeSiblingFacades({ /* test data */ });
const adapters = createCore03SiblingAdapters({
  clock,
  core01RuleEngine: facades.core01RuleEngine,
  core02ParticipantLookup: facades.core02ParticipantLookup,
  core02EntryLookup: facades.core02EntryLookup,
  core04DivisionEligibility: facades.core04DivisionEligibility,
  core05TeamRoster: facades.core05TeamRoster,
});
```

Returned intentional ports only:

- `ruleEvaluation`
- `participantLookup`
- `entryLookup`
- `entryCreation` (fail-closed unavailable by default)
- `divisionEligibility`
- `teamRosterValidation`

Plus `compatibilityMatrix`, `compositionMetadata`, `versions`.

---

## 2. Dependency direction

- Adapters **do not** deep-import sibling private files.
- Adapters **do not** import `constraints/**`, `participants/**`, `classification/**`, or `teams/**` source from Core-03 module code (Phase 1C isolation preserved).
- Sibling APIs are reached only via **dependency-injected facades** shaped like stable public methods.
- No mutable sibling state or internal storage is exposed on the composition result.
- No Production persistence / SQL / Supabase / UI.

---

## 3. Sibling public surfaces discovered

| Sibling | Public barrel | Stable method used by facade |
|---------|---------------|------------------------------|
| Core-01 | `constraints/index.js` | `evaluateCanonicalRules(ruleSet, context, options)` |
| Core-02 Participant | `participants/index.js` | `ParticipantRepositoryPort.getById` / resolver results |
| Core-02 Entry lookup | `participants/index.js` | `EntryRepositoryPort.listByCompetition` / `findActiveDuplicate` |
| Core-02 Entry creation | **gap** | No approved `createEntryFromRegistration` service |
| Core-04 | `classification/index.js` | `gateDivisionCategoryRegistration` (via `evaluateDivisionEligibility` facade) |
| Core-05 | `teams/index.js` | `validateRosterInvariants` / `createTeamRosterService().validateRoster` |

---

## 4. Compatibility matrix

Programmatic export: `getCore03SiblingCompatibilityMatrix()` / `CORE03_SIBLING_COMPATIBILITY_MATRIX`.

See matrix rows for port ↔ sibling ↔ public method ↔ mapping ↔ fail-closed behavior ↔ limitations.

---

## 5. Rule Engine mapping (Core-01)

1. Map `RuleEvaluationRequest` → `{ ruleSet, context, options }`.
2. Call injected `evaluateCanonicalRules`.
3. Normalize to `{ accepted, reasonCodes, ruleSetVersion, outcomeHint, eligibilityCheckResult }`.
4. Preserve `ruleSetId` / `ruleSetVersion` / `engineVersion`.
5. Blocking Core-01 results → `accepted:false`.
6. Exceptions / malformed / missing facade → fail-closed; **never ELIGIBLE**.

---

## 6. Participant & Entry mapping (Core-02)

### Participant

- `getByIds` preserves request order; returns defensive copies.
- `lookupParticipants` supports INDIVIDUAL / PAIR / TEAM-derived representative.
- PAIR ids are canonical-sorted; duplicate pair identity fails closed.
- Missing participant fails closed.
- Auth user id is ignored (never a fallback).

### Entry lookup

- Scope by competition (required) and division when provided.
- Target identity → stable identity key (participant / canonical pair / team).
- Detects active/conflicting Entry via explicit Core-02 status set (`APPROVED`/`ACTIVE`/`PENDING`).
- **Does not** alias Core-03 `RegistrationStatus` to Core-02 Entry status.
- Read-only — no create/modify.

### Entry creation

- **Status: `DEFERRED_FAIL_CLOSED`** (owner-accepted Phase 1E condition closure).
- Core-02 does **not** expose an approved stable public Entry creation / handoff API.
- Default `EntryCreationPort` returns `REG_ELIG_ENTRY_CREATION_ADAPTER_UNAVAILABLE`.
- Result includes `compatibilityGap` (`ENTRY_CREATION_COMPATIBILITY_GAP`).
- No Core-02 private imports; no Core-02 invariants replicated; no Entry created/modified.
- Experimental `allowUnapprovedEntryCreationFacade` / `allowUnapprovedFacade`:
  - default / absent ⇒ `false`;
  - **not** read from environment variables;
  - **not** accepted from registration / HTTP / user request payloads;
  - **not** enabled by automatic fallback;
  - **not** a normal Production runtime option;
  - only via explicit factory DI for controlled compatibility tests;
  - default `createCore03SiblingAdapters` never supplies it;
  - missing facade always fails closed.

---

## 7. Division mapping (Core-04)

- Requires competition id; mandatory division/category id fails closed when missing.
- No default/first-division selection.
- Maps ClassificationResult / port-like shapes → `{ acceptsRegistration, reasonCodes, … }`.
- Preserves `schemaVersion` on adapter metadata.
- Exception / malformed → fail-closed.

---

## 8. Team Roster mapping (Core-05)

- Validates TEAM targets only.
- INDIVIDUAL / PAIR → documented `TEAM_ROSTER_NOT_APPLICABLE` (passed / not-applicable).
- Preserves structured violation codes.
- Missing team / stale roster version / malformed → fail-closed.
- Does not invent roster members or mutate team/roster state.

---

## 9. Entry creation availability decision (condition closed)

**Owner decision:** Accept missing Core-02 Entry creation public API as a deferred,
fail-closed sibling compatibility gap. Core-03 must not deep-import or bypass Core-02.

| Option | Chosen? |
|--------|---------|
| Deep-import Core-02 internals to invent creation | **No** |
| Bypass Core-02 invariants | **No** |
| Fail-closed unavailable adapter + document gap | **Yes** |

**Phase 1F guidance:**

- Phase 1F **may** proceed for Core-03-owned persistence after Phase 1E merge.
- Phase 1F **must not** implement Core-02 Entry creation or APPROVED→Entry handoff.
- Handoff remains deferred until Core-02 publishes an approved stable public API.

**Future activation conditions (all required):**

1. Stable Core-02 public import path
2. Approved request/result contract
3. Idempotent handoff
4. Duplicate prevention
5. Version metadata
6. Integration tests
7. Ownership review

---

## 10. Error normalization

New codes (Core-03 conventions):

- `REG_ELIG_SIBLING_API_UNAVAILABLE`
- `REG_ELIG_SIBLING_MALFORMED_RESPONSE`
- `REG_ELIG_SIBLING_OPERATION_FAILED`
- `REG_ELIG_SIBLING_VERSION_MISMATCH`
- `REG_ELIG_PARTICIPANT_NOT_FOUND`
- `REG_ELIG_DUPLICATE_ENTRY_DETECTED`
- `REG_ELIG_ENTRY_CREATION_ADAPTER_UNAVAILABLE`
- `REG_ELIG_DIVISION_EVALUATION_UNAVAILABLE`
- `REG_ELIG_TEAM_ROSTER_VALIDATION_UNAVAILABLE`
- `REG_ELIG_STALE_SIBLING_RESULT`
- `REG_ELIG_UNSUPPORTED_SIBLING_CONTRACT_VERSION`

No stack traces, credentials, raw provider payloads, or mutable sibling objects are leaked.

---

## 11. Version behavior

Every adapter result may include `adapterMetadata`:

- adapter name / adapter version
- sibling capability / contract version / result version
- evaluatedAt / resolvedAt (from injected `ClockPort`)
- source IDs / warnings (deterministically sorted)

---

## 12. Deterministic behavior

- No `Date.now()` / `Math.random()` / `crypto.random*` in adapters.
- Reason codes and warnings sorted deterministically.
- Pair participant ids canonical-sorted.
- Defensive copies on outputs; inputs are not mutated.

---

## 13. Ownership boundaries

| Owned by Core-03 Phase 1E | Not owned |
|---------------------------|-----------|
| Adapter normalization + composition | Sibling business logic |
| Port implementations via DI | SQL / Supabase / RLS |
| Compatibility matrix + error codes | UI / deployment / env |
| Fail-closed Entry creation placeholder | Legacy Phase 3C registrations |

Protected files untouched: root `competition-core/index.js`, `scripts/ci/unit-test-files.json`, package/lockfiles.

---

## 14. Deferred Production persistence and runtime composition

Deferred to later phases:

1. Integrator wiring of real sibling facades in Production composition.
2. Core-02 approved Entry creation public API + handoff runtime (**blocked on Core-02**; Phase 1F must not implement it).
3. Production persistence for registration/eligibility/capacity (Phase 1F may proceed for Core-03-owned persistence).
4. Replacing in-memory test facades with live sibling clients.
