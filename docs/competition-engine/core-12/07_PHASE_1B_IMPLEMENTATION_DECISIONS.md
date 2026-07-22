# CORE-12 Phase 1B — Implementation Decisions (certified 1B-R)

| | |
|--|--|
| **Phase** | 1B / 1B-R |
| **Module** | `src/features/competition-core/court-assignment/` |
| **Schema** | `CORE12_COURT_ASSIGNMENT_SCHEMA_V1` |
| **Comparator** | `CORE12_COMPARATOR_V1` (UTF-16 code-unit ordinal) |
| **Fingerprint** | `CORE12_FINGERPRINT_V1` (FNV-1a 32-bit over canonical JSON) |
| **Selection** | `CORE12_GREEDY_FIRST_ELIGIBLE_V1` |
| **Policy pin** | `CORE12_POLICY_V1` |

Phase 1A ownership / boundary documents remain authoritative. This file records Phase 1B implementation certification decisions after 1B-R remediation.

---

## 1. Public production API surface

Capability-local entry: `court-assignment/index.js`

**Production exports include:** constants/versions, enums (canonical codes), contract factories, deterministic helpers, `validateCourtAssignmentRequest`, `assignCourtsDeterministic` / `assignCourts`, `createCourtAssignmentPort`, port method-name constants.

**Not on production surface (adapters only):**

- `createFailClosedCourtAssignmentPort` / `createFixedCourtAssignmentPort`
- `createFailClosedCourtAvailabilityPort` / `createFixedCourtAvailabilityPort`
- rule / audit test doubles
- `assignCourtsSafe` (host wrapper; reserved ERROR path)

**No root** `competition-core/index.js` export.

---

## 2. Port vs implementation

| Concern | Location |
|---------|----------|
| Canonical pure assigner | `services/assignCourtsDeterministic.js` → `assignCourtsDeterministic` |
| Port contract / production factory | `ports/courtAssignmentPort.js` → `createCourtAssignmentPort` |
| Availability consumer boundary | `CourtAvailabilityPort` method constants; doubles in `adapters/` |
| Audit | In-memory double only; **never invoked** by pure assigner |

Pure assignment is deterministic and side-effect free. No inventory/availability fetch inside the assigner.

---

## 3. Capability-local utilities (intentional isolation)

Mirrored **patterns** from CORE-10 (freeze, FNV fingerprint, UTF-16 compare) under `deterministic/`. **No runtime import of `optimizer/`**.

| Utility | Version / rule |
|---------|----------------|
| `compareStableString` | UTF-16 code units; locale-independent; no `localeCompare` |
| `fingerprintValue` | `CORE12_FINGERPRINT_V1` |
| Intervals | HALF_OPEN; absolute ISO with Z/offset; reject silent calendar normalization |

Rationale: Phase 1B forbids CORE-10 runtime coupling; no neutral shared utility package exists outside CORE-10 for these primitives. Drift risk accepted and pinned by version constants + test vectors.

---

## 4. Scope model

One assignment request = **exactly one** `(tenantId, clubId, venueId, competitionId)` scope.

- Matches must use that `competitionId` (and matching optional tenant/venue/club when present).
- Courts must match request venue/club (and tenant when present).
- Multi-competition / multi-venue requests are **not supported** — fail closed (`SCOPE_MISMATCH` / `CROSS_*`).
- No first-tenant / first-venue / first-court fallback.

---

## 5. Time and coverage

- Timezone-less instants rejected.
- Invalid calendar dates that `Date.parse` would normalize (e.g. `2026-02-30`) rejected.
- Half-open `[start, end)`; adjacent boundaries do not overlap.
- Match must be **fully covered by one** availability interval. Adjacent intervals are **not** merged.
- Empty `availabilityIntervals` + `AVAILABLE` = unrestricted within the snapshot.

---

## 6. Policy defaults

| Field | Default |
|-------|---------|
| `partialAssignmentAllowed` | `false` |
| `overrideManualLocks` | `false` |
| `acceptLockedAssignments` | `true` |
| `invalidLockBehavior` | `CONFLICT` |
| `allowUnscheduledMatches` | `false` |
| `skipTerminalStatuses` | `true` |
| `terminalStatuses` | `["completed","forfeit"]` |
| `matchOrderingStrategy` | `STABLE_PRIORITY_THEN_ID` |
| `courtOrderingStrategy` | `STABLE_PRIORITY_THEN_ID` |
| `requireVenueTimezone` | `true` |
| `requireAvailabilitySnapshot` | `true` |
| `capabilityMatchMode` | `HARD` |
| `overlapMode` | `HALF_OPEN` |
| `comparatorVersion` | `CORE12_COMPARATOR_V1` |
| `courtSelectionStrategyVersion` | `CORE12_GREEDY_FIRST_ELIGIBLE_V1` |
| `policyVersion` | must be `CORE12_POLICY_V1` |

---

## 7. Lock-policy matrix

| Situation | Behavior |
|-----------|----------|
| Valid lock | Preserve; `assignmentSource=LOCKED`; processed before auto |
| Duplicate lock same match | `REJECTED` / `DUPLICATE_LOCK` |
| Contradictory lock vs `manualCourtLock` | `REJECTED` / `DUPLICATE_LOCK` |
| Unknown match | `REJECTED` / `LOCK_REFERENCES_UNKNOWN_MATCH` |
| Unknown court | `REJECTED` / `LOCK_REFERENCES_UNKNOWN_COURT` |
| Disabled / unavailable / maintenance / window | `LOCK_COURT_UNAVAILABLE` (or `REJECTED` if `invalidLockBehavior=REJECT_REQUEST`) |
| Capability mismatch | `LOCK_CAPABILITY_MISMATCH` (or `REJECTED` if REJECT_REQUEST) |
| Lock overlap | `LOCK_OVERLAP` (or `REJECTED` if REJECT_REQUEST) |
| Scope mismatch on lock feasibility | `LOCK_SCOPE_MISMATCH` |
| `acceptLockedAssignments=false` with locks present | `REJECTED` / `LOCKS_NOT_ACCEPTED` |
| Auto vs valid lock | Auto cannot displace lock |

Invalid locks are never silently ignored.

---

## 8. Partial-assignment semantics — Model B (diagnostic)

When `partialAssignmentAllowed=false` and one or more required matches remain unassigned:

- `status = INFEASIBLE`
- `committable = false`
- `assignments[]` may contain **provisional** greedy/lock results for diagnostics
- `unassigned[]` + `conflicts[]` include `PARTIAL_ASSIGNMENT_NOT_ALLOWED` and per-match reasons
- **Callers MUST NOT persist** assignments unless `committable === true`

When `partialAssignmentAllowed=true` and some (not all) assign:

- `status = PARTIAL`
- `committable = true` (policy-authorized partial persist)

`SUCCESS` ⇒ `committable = true`. `REJECTED` ⇒ `committable = false`, empty assignments.

---

## 9. Status semantics

| Status | Entry condition | Emitted by pure assigner? |
|--------|-----------------|---------------------------|
| `SUCCESS` | No required shortfall | Yes |
| `PARTIAL` | Shortfall + `partialAssignmentAllowed` + ≥1 assignment | Yes |
| `INFEASIBLE` | Shortfall without allowed partial | Yes |
| `REJECTED` | Validation / invalid-lock REJECT_REQUEST | Yes |
| `ERROR` | Reserved for unexpected host faults | **No** (only via adapters `assignCourtsSafe`, sanitized) |

Expected validation/infeasibility never become `ERROR`. Convention: pure API **returns** structured results; it does not throw for expected failures.

---

## 10. Canonical reason codes

Emitted codes come only from `COURT_ASSIGNMENT_REJECTION_CODE` and `COURT_ASSIGNMENT_CONFLICT_CODE`.

Lookup aliases (`COURT_TIME_CONFLICT` → `COURT_TIME_OVERLAP`, etc.) live in `*_ALIASES` maps and are **never emitted**.

Canonical overlap emission: **`COURT_TIME_OVERLAP`** (auto) / **`LOCK_OVERLAP`** (locks).

---

## 11. Fingerprint payload (assignable material)

Includes: schema, status, `committable`, scope ids, **policy knobs** (id/version/comparator/selection/partial/capability/overlap/orderings/lock policy), ordered assignments/unassigned/conflicts (stable id order), compact diagnostics counts + orderingVersions, fingerprint algorithm version.

Excludes: wall-clock, random ids, stack traces, audit events, non-canonical aliases, host identity.

---

## 12. Deferred integrations

Live Competition Availability Adapter (1D), TE parity (1C), CORE-01 rules (1E), CORE-11/14/10 wiring, UI/SQL/Supabase, root export.
