# CORE-12 — Invariants and Conflict Model

**Phase:** 1A design only (1A-R remediated)  
**Applies to:** Canonical `CourtAssignmentPort.assignCourts` behavior

**Conflict ownership note:**

- **CORE-12** must prevent overlapping court allocations **inside its own assignment request**.
- **CORE-14 Resource Conflict Resolver** will handle broader cross-resource / cross-module conflicts once its public contract is available.
- CORE-12 must **not** recreate a generic Resource Conflict Resolver.
- CORE-14 integration is **deferred and optional** until that contract is merged and stable.

---

## 1. Required invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | **No court overlap** for intersecting match windows on the same `courtId` | HARD — reject candidate; emit `COURT_TIME_OVERLAP` if locked forces violation |
| 2 | **No cross-tenant / cross-venue / cross-club assignment** | HARD — `REJECTED` on request validation |
| 3 | **No assignment to disabled / unavailable / maintenance / locked courts** | HARD — court ineligible; `COURT_UNAVAILABLE` |
| 4 | **Match and court time windows must be compatible** | HARD — civil window must fit availability; ISO window valid |
| 5 | **Locked manual assignments cannot be silently replaced** | HARD — preserve unless `overrideManualLocks===true` and lock allows override |
| 6 | **Duplicate match IDs and court IDs are rejected** | HARD — `REJECTED` |
| 7 | **Invalid or reversed time windows are rejected** | HARD — `INVALID_TIME_WINDOW` |
| 8 | **Deterministic inputs → deterministic outputs** | Structural — same fingerprints + policy + seed → same result fingerprint |
| 9 | **Assignment ordering is stable** | Structural — documented comparator versions |
| 10 | **Unassignable matches return structured reasons** | Always populate `unassigned[]` + conflicts |
| 11 | **Partial assignment is policy-controlled** | `PARTIAL` only if `partialAssignmentAllowed`; else `INFEASIBLE` |
| 12 | **No hidden first-venue or first-court fallback** | Forbidden — missing eligibility ⇒ unassigned/infeasible |
| 13 | **No browser state / UI store dependence** | Port purity — all inputs on request |
| 14 | **Timezone assumptions are explicit** | Fail closed when required timezone missing |
| 15 | **Input data must not be mutated** | Factories clone; engine uses internal working copies only |

---

## 2. Overlap semantics

Default `overlapMode = HALF_OPEN`:

```text
overlaps(A, B) ⇔ A.start < B.end && B.start < A.end
```

Adjacent matches where `A.end === B.start` do **not** overlap.

Buffers belong to **CORE-11 Schedule Engine** when that upstream owns packed windows (already embedded in absolute intervals). CORE-12 does not silently inflate windows unless an explicit HARD constraint supplies buffer expansion (discouraged; prefer schedule-owned windows). Until CORE-11’s public contract is on main, treat packed windows as inputs to capability-local `ScheduledMatchInput` — do not hard-code unsupported CORE-11 shapes.

---

## 3. Eligibility pipeline (per match, per court)

Order is fixed for determinism:

1. Request-level validation already passed.
2. Skip terminal matches when policy says so (not unassigned — simply out of assignable set).
3. BYE / `isBye` → must not assign (`BYE_MUST_NOT_CONSUME_COURT` if attempted).
4. If locked and not overridden → validate lock feasibility only; do not search.
5. Otherwise scan courts in `courtOrderingStrategy` order:
   - scope ids match
   - `active === true`
   - `availabilityStatus === AVAILABLE`
   - no overlap with already accepted assignments on that court
   - civil/availability window compatible
   - capability constraints satisfied (per `capabilityMatchMode`)
   - soft constraints may rank but must not reorder ahead of stable comparator unless policy explicitly defines soft scoring version (Phase 1B baseline: soft scores optional; hard eligibility first, then stable court order)
6. First eligible court wins (greedy baseline). No random choice without seeded PRNG policy.

---

## 4. Conflict / reason code catalog

### 4.1 Request rejection codes (`status = REJECTED`)

| Code | Meaning |
|------|---------|
| `SCHEMA_VERSION_MISMATCH` | Wrong/missing schema |
| `UNKNOWN_FIELD` | Strict schema violation |
| `DUPLICATE_MATCH_ID` | Duplicate in `matches` |
| `DUPLICATE_COURT_ID` | Duplicate in `courts` |
| `INVALID_TIME_WINDOW` | Missing, equal, or reversed start/end |
| `INVALID_CIVIL_WINDOW` | Civil window malformed or not representable unambiguously for the current Competition Availability Adapter (today: overnight operating windows are unsupported upstream — fail closed; do not invent overnight policy in CORE-12) |
| `TIMEZONE_REQUIRED` | Missing IANA timezone |
| `SCOPE_MISMATCH` | tenant/club/venue/competition inconsistency |
| `CROSS_TENANT_REFERENCE` | Entity scope mismatch |
| `CROSS_VENUE_REFERENCE` | Court venue ≠ request venue |
| `CROSS_CLUB_REFERENCE` | Court club ≠ request club |
| `LOCK_REFERENCES_UNKNOWN_MATCH` | Locked match missing |
| `LOCK_REFERENCES_UNKNOWN_COURT` | Locked court missing |
| `SEED_REQUIRED` | PRNG policy without seed |
| `AVAILABILITY_SNAPSHOT_REQUIRED` | Missing fingerprint/snapshot when required |
| `NON_CANONICAL_VALUE` | Date/Map/function/NaN in certified input |

### 4.2 Assignment conflict codes (`conflicts[]`)

| Code | Severity | Meaning |
|------|----------|---------|
| `COURT_TIME_OVERLAP` | HARD | Two matches share court with intersecting windows |
| `COURT_UNAVAILABLE` | HARD | Court not available for window |
| `COURT_DISABLED` | HARD | Inactive / disabled |
| `COURT_MAINTENANCE` | HARD | Maintenance |
| `COURT_LOCKED_INVENTORY` | HARD | Inventory lock (not manual match lock) |
| `CAPABILITY_MISMATCH` | HARD/SOFT | Court lacks required capability |
| `WINDOW_INCOMPATIBLE` | HARD | Match window outside court availability |
| `LOCKED_ASSIGNMENT_INFEASIBLE` | HARD | Manual lock cannot be honored |
| `LOCKED_ASSIGNMENT_OVERRIDE_DENIED` | HARD | Attempted replace without override |
| `NO_ELIGIBLE_COURT` | HARD | Scan exhausted |
| `BYE_MUST_NOT_CONSUME_COURT` | HARD | Bye given a court |
| `DUPLICATE_MATCH_ASSIGNMENT` | HARD | Same match assigned twice in working set |
| `AVAILABILITY_DATA_UNAVAILABLE` | HARD | Port failure fail-closed |
| `RULE_HARD_VIOLATION` | HARD | CORE-01 evaluated hard rule failed |
| `RULE_SOFT_VIOLATION` | SOFT | Soft rule failed (diagnostic) |

### 4.3 Unassigned reason codes

Prefer the same codes as conflicts for machine handling. `UnassignedMatch.reasonCode` should be one of the HARD codes above (typically `NO_ELIGIBLE_COURT`, `LOCKED_ASSIGNMENT_INFEASIBLE`, `COURT_UNAVAILABLE`, …).

---

## 5. Status determination

```text
if request invalid → REJECTED
else if engine/port error → ERROR
else if assignableCount == 0 → SUCCESS (trivial)
else if unassignedCount == 0 && no HARD unresolved lock conflicts → SUCCESS
else if partialAssignmentAllowed && assignedCount > 0 → PARTIAL
else → INFEASIBLE
```

**Anti-pattern from legacy TE:** treating `ok = conflicts.length === 0 || assignments.length > 0` as success. CORE-12 forbids that ambiguity.

---

## 6. Locked assignment matrix

| Situation | `overrideManualLocks` | Result |
|-----------|----------------------|--------|
| Lock feasible | any | Preserve; `assignmentSource=LOCKED` |
| Lock infeasible | false | Conflict `LOCKED_ASSIGNMENT_INFEASIBLE`; match unassigned or conflict-only |
| Lock infeasible | true and overrideAllowed | May reassign via auto scan; emit INFO/SOFT diagnostic that lock was overridden |
| Lock infeasible | true and !overrideAllowed | Same as false — deny |
| Auto would replace unlocked existingCourtId | n/a | Allowed; source `AUTO` |
| Auto would replace manualCourtLock without override | false | Preserve |

---

## 7. Determinism rules

1. Sort matches by declared `matchOrderingStrategy` before assignment.
2. Sort courts by declared `courtOrderingStrategy` before scan.
3. Tie-break always by lexicographic `matchId` / `courtId` (Unicode code-point / UTF-16 as used by `String.prototype.localeCompare` with explicit `en` or documented comparator — **do not** use `"vi"` locale for certified fingerprints unless comparatorVersion pins that locale).
4. Proposed certified baseline: `localeCompare(idA, idB)` with no locale argument **or** explicit `"en"` — pin in `comparatorVersion`.
5. Soft preference scores, if introduced, must be quantized integers and versioned; they must not use wall-clock or `Math.random`.
6. Result arrays sorted by id before fingerprinting.

---

## 8. Concurrency and idempotency

Phase 1A / 1B engines are **pure functions** over snapshots — no optimistic locking inside CORE-12.

Later persistence (Integrator):

- Idempotency key on apply-assignment commands (lineup pattern).
- Conflict if snapshot fingerprints drift (`scheduleSnapshotRef`, `availabilitySnapshotRef`).
- CORE-12 domain still returns structural conflicts; persistence adapters translate to storage races.

---

## 9. Mutation ban

- No `match.courtId = …` on caller objects.
- Working set is internal; outputs are new frozen structures.
- Adapters that update UI state must copy from `CourtAssignmentResult` explicitly.

---

## 10. Test implications (design)

Phase 1B must cover **at least 15 Owner-required invariant groups** (the fifteen invariants in §1). Every Owner-required invariant must be **traceable to one or more tests**. Actual test count should **exceed 15** where multiple positive and negative cases are needed.

Dedicated edge-case coverage is required for at least:

- timezone missing / mismatched / civil-vs-absolute ambiguity
- duplicate match IDs and duplicate court IDs
- locked assignment preserve / infeasible / override-denied
- partial assignment policy (`PARTIAL` vs `INFEASIBLE`)
- deterministic ordering (shuffled inputs → identical `resultFingerprint`)

### 10.1 Minimum invariant-group coverage map

| # | Invariant group | Example cases (non-exhaustive) |
|---|-----------------|--------------------------------|
| 1 | No court overlap | Overlap rejection; adjacent non-overlap allowed |
| 2 | No cross-tenant / cross-venue / cross-club | Cross-venue court rejected; scope mismatch rejected |
| 3 | No disabled / unavailable courts | Disabled skipped; maintenance skipped |
| 4 | Match/court window compatibility | Window incompatible; unambiguous absolute intervals |
| 5 | Locked assignments not silently replaced | Preserve lock; override denied |
| 6 | Duplicate IDs rejected | Duplicate matchId; duplicate courtId |
| 7 | Invalid / reversed time windows rejected | Reversed ISO; equal start/end |
| 8 | Deterministic I/O | Same request twice → identical `resultFingerprint` |
| 9 | Stable assignment ordering | Shuffled input arrays → stable assignment order |
| 10 | Structured unassigned reasons | `NO_ELIGIBLE_COURT` populated with codes |
| 11 | Partial assignment policy-controlled | `partialAssignmentAllowed` true vs false fork |
| 12 | No hidden first-venue / first-court fallback | Empty eligible set → unassigned/infeasible (no phantom court) |
| 13 | No UI / browser state dependence | Port purity / request-only inputs |
| 14 | Explicit timezone assumptions | Timezone missing → `REJECTED` when required |
| 15 | Input not mutated | Deep-equal inputs before/after call |

Additional cases (push total **> 15 tests**): locked infeasible conflict, capability mismatch, bye must not consume court, availability snapshot required, non-representable civil/overnight projection fail-closed.
