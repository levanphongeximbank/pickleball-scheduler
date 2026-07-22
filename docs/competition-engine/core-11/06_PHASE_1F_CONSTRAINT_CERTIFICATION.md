# CORE-11 Phase 1F — Hard-Constraint Certification

## Purpose

Phase 1F independently validates and certifies an existing Phase 1E baseline schedule candidate against hard constraints.

It does **not**:

- reschedule, reorder, or optimize matches;
- publish or finalize a schedule;
- assign physical courts or referees;
- mutate the input candidate.

Preferred public API:

```js
certifyBaselineScheduleCandidateConstraints(request, candidate)
```

## Certification result contract

```js
{
  ok: boolean,
  status: "CONSTRAINT_CERTIFICATION_RESULT",
  certification: "HARD_CONSTRAINTS_CERTIFIED" | "HARD_CONSTRAINTS_REJECTED",
  candidateStatus: "BASELINE_SCHEDULE_CANDIDATE",
  violations: [],
  diagnostics: [],
  checkedConstraintCodes: [],
  deferredConstraintCodes: [],
  replay: {
    engineId: "CORE11_SCHEDULE_ENGINE",
    engineVersion: "core11-v1",
    requestFingerprint: "...",
    candidateFingerprint: "..."
  }
}
```

Success does not rename the candidate. The candidate remains:

- `status: BASELINE_SCHEDULE_CANDIDATE`
- `constraintCertification: BASELINE_ONLY`

## Independent validation principle

A candidate is never assumed valid merely because Phase 1E produced it.

The certifier:

1. accepts only canonical request and candidate contracts;
2. revalidates timing, windows, sessions, dependencies, capacity, completeness, and participant/team constraints;
3. detects externally constructed or tampered candidates;
4. never calls Phase 1E to regenerate or repair.

## Participant identity and resource-key model

Backward-compatible participant reference extension:

```js
{
  participantId: "entry-1",
  kind: "ENTRY", // PLAYER | TEAM | ENTRY | PLACEHOLDER | UNKNOWN
  constraintResourceIds: ["player:player-101", "player:player-102"]
}
```

Rules:

- `participantId` remains the canonical participant / team / entry reference.
- Direct `PLAYER` references contribute their own stable player key.
- `TEAM` / `ENTRY` references contribute their own team/entry key.
- Optional `constraintResourceIds` provide shared-player or shared-resource identity.
- IDs are non-empty trimmed strings; duplicates are normalized deterministically.
- Resource identity does not depend on display names or metadata.

## Unresolved placeholder policy

Future-round matches may contain placeholders. Phase 1F distinguishes:

### Concrete identity

Direct `PLAYER` / `TEAM` / `ENTRY` references (and supplied `constraintResourceIds`) are checked normally for overlap, rest, and shared-player conflicts.

### Structurally resolvable placeholder

Placeholders derived from canonical lineage dependencies:

- `WINNER_OF`
- `LOSER_OF`
- `PREVIOUS_ROUND`

may be scheduled before the source match completes.

CORE-11 **does not** infer the actual winner or loser. For hard-constraint certification it derives a deterministic **conservative possible-resource set** from the source match lineage (transitively across rounds), unions branching sources, deduplicates with ASCII ordering, and checks overlap/rest against every possible resource.

Lineage cycles fail closed without infinite recursion. Display names and scores are never used.

### Opaque unresolved placeholder

When no sufficient identity lineage can be established (including external barriers such as `GROUP_STAGE_COMPLETE` / `QUALIFICATION` without participant lineage):

- emit `PARTICIPANT_IDENTITY_UNRESOLVED` with match and participant reference;
- reject hard-constraint certification where overlap/rest safety cannot be proven.

Do not silently treat opaque placeholders as conflict-free.

### Bye lineage

A bye may satisfy structural dependency readiness but:

- does not create a participant identity;
- does not create a match interval;
- does not fabricate rest or timing;
- must not produce a synthetic resource ID.

## Canonical fingerprints

Certification replay metadata uses:

- `fingerprintScheduleRequest(request)` — semantic request projection
- `fingerprintBaselineScheduleCandidate(candidate)` — semantic candidate projection

Request fingerprint includes competition/scope ids, timezone, matches (ids, participants, kinds, `constraintResourceIds`, dependencies), durations, rest/capacity policy, operating and session windows — normalized and input-order independent.

Candidate fingerprint includes candidate status, `BASELINE_ONLY` marker, scheduled/unscheduled partitions, civil/UTC timing, duration/buffer/capacity release, concurrency/abstract-slot indexes, and session ids.

Excluded: `producedAt`, raw caller key order, display-only labels, diagnostics noise, and non-semantic wall-clock metadata.

Identical semantic inputs always produce identical fingerprints. Changing time, resources, rest, capacity, windows, occupancy, or schedule partition changes the fingerprint.

## Participant overlap

For every concrete participant or constraint resource:

- actual match intervals must not overlap;
- intervals are half-open `[startUtcMs, endUtcMs)`;
- capacity buffer is **not** participant rest;
- matches touching at the same instant do not overlap;
- diagnostics use `PARTICIPANT_OVERLAP`.

## Team / entry overlap

A team or entry must not appear in overlapping matches.

- Uses team / entry identity from canonical participant references.
- Separate from shared-player overlap.
- Diagnostics use `TEAM_OVERLAP`.

## Shared-player conflicts

When the same player appears under different entries/teams via `constraintResourceIds`, overlapping matches produce `PARTICIPANT_OVERLAP` for that resource key.

The certifier flattens deterministic resource keys and avoids duplicate reporting for the same resource and match pair.

## Participant rest

Canonical policy: `minParticipantRestMinutes`.

- Hard constraint.
- Zero disables checking.
- Gap: `later.startUtcMs - earlier.endUtcMs` must be ≥ required rest.
- Capacity buffer is not substituted for rest.
- Cross-session and cross-day gaps are checked.
- Touching matches have zero rest.
- Diagnostics: `INSUFFICIENT_REST` with structured `restKind: "PARTICIPANT"`.

## Team rest

Canonical policy: `minTeamRestMinutes`.

- Zero disables checking.
- Separate from participant rest.
- Same gap formula on team / entry identities.
- Diagnostics: `INSUFFICIENT_REST` with `restKind: "TEAM"`.

## Operating-window and session certification

Independently verify each scheduled match:

- civil / UTC consistency via Phase 1C conversion;
- containment in an approved operating window when sessions are empty;
- when sessions are configured: valid `sessionId`, containment, no session-boundary crossing, no operating-window fallback;
- timezone and overnight rejection;
- diagnostics such as `MATCH_OUTSIDE_ALLOWED_WINDOW`, `UNKNOWN_SESSION_ID`, `MATCH_TIME_INCONSISTENT`.

## Dependency certification

Independently revalidate:

- graph validity, unknown dependencies, cycles;
- predecessor before dependent;
- unscheduled required predecessors;
- earliest-start lower bound including dependency buffer applied once;
- bye timing does not fabricate absolute times.

Codes: `UNKNOWN_MATCH_DEPENDENCY`, `CYCLIC_MATCH_DEPENDENCY`, `DEPENDENCY_ORDER_VIOLATION`, `PREDECESSOR_UNSCHEDULED`, `DEPENDENCY_TIMING_UNAVAILABLE`.

## Abstract capacity certification

- Occupancy: `[startUtcMs, capacityReleaseUtcMs)`.
- `capacityReleaseUtcMs` must equal actual end + configured buffer.
- Concurrent occupancy ≤ `maxConcurrentMatches`.
- `concurrencyIndex` non-negative, below capacity, non-overlapping within the same index.
- No physical court identity.
- Codes: `CAPACITY_EXCEEDED`, `CAPACITY_RELEASE_INCONSISTENT`, `CONCURRENCY_INDEX_INVALID`.

## Completeness

- Byes appear in neither scheduled nor unscheduled arrays.
- Each non-bye appears exactly once in scheduled or unscheduled.
- Unknown, missing, or duplicate IDs fail.
- Candidate status must remain `BASELINE_SCHEDULE_CANDIDATE`.
- Pre-Phase-1F marker must remain `BASELINE_ONLY`.
- Any unscheduled non-bye prevents `HARD_CONSTRAINTS_CERTIFIED` (`SCHEDULE_INCOMPLETE` / `BASELINE_CANDIDATE_INCOMPLETE`).

## Plan-tampering detection

Detects inconsistent civil/UTC, duration, capacity release, concurrency occupancy, unknown/missing matches, forbidden physical fields (`courtId`, `refereeId`, …), invalid sessions, dependency order violations, and forged status / certification markers.

Expected invalid plans return structured diagnostics rather than generic throws.

## Certification statuses

| Result | Meaning |
|--------|---------|
| `HARD_CONSTRAINTS_CERTIFIED` | All checked hard constraints pass; schedule complete |
| `HARD_CONSTRAINTS_REJECTED` | One or more hard constraints failed |

Soft optimization remains deferred to CORE-10. Physical court feasibility remains deferred to CORE-12.

## Diagnostics

Reused codes where possible. Phase 1F additions include:

- `PARTICIPANT_IDENTITY_UNRESOLVED`
- `UNKNOWN_CANDIDATE_MATCH`
- `MATCH_TIME_INCONSISTENT`
- `CAPACITY_RELEASE_INCONSISTENT`
- `UNKNOWN_SESSION_ID`
- `CONCURRENCY_INDEX_INVALID`
- `HARD_CONSTRAINT_CERTIFICATION_FAILED`

Diagnostics and violations are deterministically ordered.

## Deterministic behavior

- Input-order-independent certification
- Deterministic match-pair, resource, violation, and diagnostic ordering
- Deterministic fingerprints
- ASCII / code-point comparison only
- No `Date.now`, `Math.random`, random UUID, or `localeCompare`
- No input mutation
- No automatic candidate repair

## Implemented files

| Path | Role |
|------|------|
| `scheduleConstraintCertification.js` | Main certifier |
| `scheduleParticipantConstraints.js` | Identity / overlap / rest helpers |
| `scheduleConstants.js` | Certification statuses and kinds |
| `scheduleDiagnostics.js` | New diagnostic codes |
| `scheduleTypes.js` / `scheduleContracts.js` | Participant reference extensions |
| `index.js` | Public exports |

## Test coverage

`tests/competition-core-schedule-engine-core11-phase1f-constraint-certification.test.js` covers overlap, rest, shared players, placeholders, completeness, windows/sessions, dependencies, capacity, tampering, determinism, immutability, and boundary imports.

## Deferred integration

- Upstream identity adapter (roster / lineup → `constraintResourceIds`)
- Unresolved bracket identity lineage enrichment
- CORE-09 MatchPlan adapter
- CORE-10 optimization runtime
- CORE-12 physical court feasibility
- Persistence / UI / Production cutover
- Legacy TE / TT replacement

## Next proposed phase

Phase 1G (proposed): soft-constraint diagnostics and certification reporting depth without scheduling repair, or CORE-09 request adapter scaffolding — subject to Owner authorization.
