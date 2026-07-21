# CORE-07 — Phase 1D Seed Allocation Report

**Phase:** 1D — Deterministic Seed Allocation Runtime
**Branch:** `feature/competition-core-07-seeding`
**Baseline HEAD (pre-remediation sync):** `9f71f4406b057f7911d1a83430d8221060a9b948`
**Date:** 2026-07-21
**Status:** Implementation complete with targeted CLEAR remediation — **Owner commit authorized**

---

## 1. Objective

Capability-local pure runtime that builds a **DRAFT** `SeedingResult` from Phase 1C-normalized scope/candidates/policy plus validated overrides, snapshot provenance, and an injected `FingerprintPort`.

No finalization, persistence, production wiring, or legacy engine changes.

---

## 2. Allocation flow

1. Normalize scope, policy (ordering + `seedNumberStart` / `maximumSeededEntries` / `manualOverrideMode`), candidates, overrides.
2. Partition INELIGIBLE / UNKNOWN → `excludedEntries`.
3. `reserveOverrideSeedSlots` — deterministic conflict detection + reservations + targeted CLEAR.
4. Sort remaining eligible (non-reserved) candidates with Phase 1C comparator.
5. `allocateSeedNumbers` — fill free seed numbers ascending, skipping reserved slots; stop at `maximumSeededEntries`.
6. Build immutable `SeedAssignment[]` sorted by `seedNumber`.
7. Build canonical fingerprint payload (excludes `generatedAt`); fingerprint via injected port.
8. Emit DRAFT `SeedingResult` (includes `acceptedClears` audit records).

---

## 3. Targeted CLEAR semantics (Owner remediation)

### Additive request field

| Field | Required when | Meaning |
|-------|---------------|---------|
| `targetOverrideId` | `action === CLEAR` | Exact DRAFT override identity to clear |

This is an additive Phase 1D contract field (Phase 1B docs named CLEAR intent but did not freeze the target reference field). **No Phase 1B markdown files were modified.**

### Processing

| Case | Behaviour |
|------|-----------|
| Valid CLEAR → ASSIGN/PROTECT `targetOverrideId` | Target removed from reservation; CLEAR → `acceptedClears` (`ACCEPTED`) |
| Same `entryId`, other override | **Unaffected** |
| Unknown `targetOverrideId` | CLEAR `REJECTED` (`INVALID_REQUEST`) |
| Target is CLEAR | CLEAR `REJECTED` (`INVALID_REQUEST`) |
| Target already rejected/inactive | CLEAR `REJECTED` (`OVERRIDE_CONFLICT`) |
| CLEAR.entryId ≠ target.entryId | CLEAR `REJECTED` (`INVALID_SCOPE`) |
| Cross-scope via `auditMetadata.seedingScope` mismatch | CLEAR `REJECTED` (`INVALID_SCOPE`) |
| Duplicate CLEAR same target | **All** such CLEARs `REJECTED` (`OVERRIDE_CONFLICT`); target remains |
| Accepted CLEAR | Does **not** reserve a seed; retains `targetOverrideId`, actor, policy/scope provenance |

**Removed:** `clearByEntry` / entryId-only suppression. No undocumented fallback.

Processing order: overrides sorted by **`overrideId` ASC** (not input array order).

---

## 4. Assignment / result fields

**SeedAssignment:** entryId, seedNumber, assignmentSource (`MANUAL_OVERRIDE` \| `PROTECTED` \| `AUTO_ORDER`), scoreValuesUsed, orderedTieBreakValues, policyId/version, snapshotId, overrideId, reasonCodes, deterministicOrdinal, assignmentFingerprint.

**SeedingResult (DRAFT only):** contractVersion, requestId, resultId/version, scope, orderedAssignments, eligibleUnseededEntries, excludedEntries, rejectedOverrides, **acceptedClears**, warnings, policy/snapshot provenance, deterministicContext, deterministicFingerprint, generatedAt (caller-supplied), finalizationState=`DRAFT`.

Domain builders exported as `createCore07SeedAssignment` / `createCore07DraftSeedingResultDocument` to avoid Phase 3G name collisions.

---

## 5. Fingerprint port boundary

- Canonical JSON with sorted object keys; **excludes `generatedAt`**.
- `createDraftSeedingResult` **requires** an injected valid `FingerprintPort` (fail closed if missing/invalid/empty/throw → `INTERNAL_PORT_FAILURE`).
- **No** runtime FNV fallback.
- **No** `node:crypto` in capability runtime.
- Test-only stub: `tests/helpers/core07FingerprintStub.js` (`createCore07TestFingerprintStub`) — **not** exported from `seeding/index.js`.

---

## 6. Ports (contracts only)

| Port | File | Adapter |
|------|------|---------|
| FingerprintPort | `ports/FingerprintPort.js` | Injected only |
| EligibilityDecisionPort | `ports/EligibilityDecisionPort.js` | None |
| RuleEvaluationPort | `ports/RuleEvaluationPort.js` | None |

---

## 7. Test evidence

```text
node --test tests/competition-core-seeding-core07.test.js
node --test tests/competition-core-seeding-core07-phase1d.test.js  (×2)
node --test tests/competition-core-seeding-runtime-3g.test.js
```

---

## 8. Deferred — Phase 1E

FINALIZED/SUPERSEDED transitions, persistence, CORE-03/01 adapters, Owner-gated shadow. Still out: Draw/snake/UI/SQL/root export/legacy cutover.
