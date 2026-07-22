# CORE-11 Phase 1E-R1 — Participant Rest-Aware Baseline Placement

| | |
|--|--|
| **Phase** | **1E-R1 — Rest-aware placement remediation** |
| **Date** | 2026-07-22 |
| **Prior** | Phase 1I blocked by `INSUFFICIENT_REST` on authorized fixture |
| **Status** | Implementation complete (not committed) |
| **Does not complete** | Phase 1I end-to-end certification |

---

## 1. Phase 1I blocker reproduction

Authorized fixture (before remediation):

```text
maxConcurrentMatches: 2
minParticipantRestMinutes: 15
bufferMinutes: 0
dependencyBufferMinutes: 0

m1: P1–P2  → 08:00–08:30
m2: P3–P4  → 08:00–08:30 (concurrent abstract capacity)
m3: P1–P5  → 08:30–09:00   ← zero rest for P1
```

Phase 1F correctly rejected with `INSUFFICIENT_REST`.
Stages D–F of Phase 1I could not certify success without changing policy or runtime.

---

## 2. Root cause

Phase 1E baseline placement enforced:

* dependency earliest-start (+ dependency/capacity buffer);
* abstract concurrency capacity;
* operating/session window containment.

It listed `INSUFFICIENT_REST` / `MIN_TEAM_REST` under **deferredConstraints** and did **not** consult `minParticipantRestMinutes` when choosing a slot.

Participant rest began only at Phase 1F certification — too late for a legal candidate under the authorized zero-buffer fixture.

---

## 3. Why increasing global buffer was rejected

Owner rejected:

```text
effectiveBuffer = max(bufferMinutes, minParticipantRestMinutes)
```

and any policy that raises `bufferMinutes` / `dependencyBufferMinutes` merely to simulate rest.

Reasons:

1. Capacity buffer delays **abstract lane release**, not participant recovery.
2. Dependency buffer delays **dependent matches**, including disjoint-participant dependents.
3. Rest is **resource-specific**; disjoint matches must not be delayed by another participant’s rest.
4. Combining buffers would over-constrain the schedule and blur three distinct contracts.

---

## 4. Participant/resource-specific rest semantics

For each schedulable non-bye match, Phase 1E-R1 derives constraint resources with the same Phase 1F helpers:

* `deriveConservativeConstraintResources` / concrete `extractConstraintResources`
* Canonical IDs from `participantId` and explicit `constraintResourceIds`
* Kinds: `PARTICIPANT`, `TEAM`, `SHARED_PLAYER` (ENTRY maps to TEAM resources)

| Resource kind | Identity source | Rest policy | Placement | Phase 1F |
|--|--|--|--|--|
| `PARTICIPANT` | `participantId` (PLAYER) | `minParticipantRestMinutes` | `end + rest` | same |
| `SHARED_PLAYER` | explicit `constraintResourceIds` (**Option A**) | `minParticipantRestMinutes` | `end + rest` | same |
| `TEAM` | `participantId` (TEAM/ENTRY) | `minTeamRestMinutes` | `end + rest` | same |
| unresolved / PLACEHOLDER | conservative lineage union | per derived kind | same | same |
| bye | excluded from topo order | none | no reservation | no identity |

**Option A (approved):** generic explicit `constraintResourceIds` are typed `SHARED_PLAYER` and always use participant rest — matching Phase 1F `certifyResourceTimeline`.

**Zero rest:** `earliest = prior.actualEnd + 0` still forbids concurrent reuse of the same resource (half-open touch at end is legal; overlap is not). Zero rest does **not** create a positive artificial gap and does **not** become capacity buffer.

---

## 5. Placement lower-bound calculation

Internal rest state:

```text
latestEndByConstraintResourceId: Map<kind\0resourceId, { endUtcMs, end civil }>
```

After a successful non-bye placement, each match resource is updated with the match’s **actual scheduled end** (`endUtcMs` / civil end).

For the next match:

```text
resourceRestEarliestStart =
  max over resources used by the match of:
    prior.endUtcMs + applicableRestMinutes
```

Effective earliest start (architecture-faithful merge):

```text
effectiveEarliestStart = max(
  dependency earliest-start (includes dependency buffer),
  participant/resource rest earliest-start
)
```

`placeMatchIntoCandidateSlot` then searches forward under:

* operating / session windows;
* abstract capacity occupancy (capacity buffer on lane release);
* duration;
* the combined earliest UTC + civil seed.

No backward rounding. Minute-level civil seeds support **08:45** when required.

---

## 6. Capacity buffer vs dependency buffer vs participant rest

| Mechanism | Anchors | Affects | Distinct? |
|--|--|--|--|
| **Capacity buffer** | match end → `capacityReleaseUtcMs` | abstract concurrency lane | Yes |
| **Dependency buffer** | predecessor end → dependent earliest | dependency edges only | Yes |
| **Participant rest** | prior resource match **end** → next shared-resource earliest | shared conflict resources only | Yes |

Rest never uses `capacityReleaseUtcMs` as the participant end anchor.

---

## 7. Resource identity source

Preferred / used:

```text
constraintResourceIds (explicit)
participantId (PLAYER / TEAM / ENTRY per kind rules)
```

Never inferred from display labels, stage labels, team names, or array indexes.

---

## 8. Rest state and update rules

1. Initialize empty map.
2. On successful placement of a non-bye match, update each derived resource key to that match’s end (keep latest end if multiple).
3. Byes are excluded from topo `order` and never update rest state.
4. Duplicate resource IDs are deduped; order of input resource arrays does not change fingerprints after canonicalization.

---

## 9. Window / capacity interaction

* If capacity frees earlier than rest, rest wins.
* If capacity frees later than rest, capacity wins.
* Disjoint concurrent matches remain allowed under `maxConcurrentMatches`.
* `concurrencyIndex` remains an abstract lane — never a court or resource id.
* When the rest-aware start cannot fit the current session, search continues into later valid sessions (existing candidate generation).

Authorized fixture outcome after remediation:

```text
m1: 08:00–08:30 (ci 0)
m2: 08:00–08:30 (ci 1)
m3: 08:45–09:15 (ci 0)   ← first minute-valid rest-legal slot
```

---

## 10. Infeasibility behavior

When no rest-legal slot exists:

* match is **unscheduled** with existing `NO_FEASIBLE_TIME_SLOT` (or other existing codes);
* no illegal placement is emitted;
* Phase 1F remains an independent defense for forged candidates.

---

## 11. Phase 1F defense-in-depth

Phase 1F still independently rechecks rest / overlap.

Baseline metadata after R1:

* `certifiedConstraints` includes `INSUFFICIENT_REST`, `MIN_TEAM_REST`, `PARTICIPANT_OVERLAP`, `TEAM_OVERLAP` (placement-enforced for derived resources; Phase 1F rechecks).
* `deferredConstraints` retains physical court and referee only.
* Phase 1F is **not** weakened.

Duplication note: Phase 1E calls the existing public `deriveConservativeConstraintResources` helper from `scheduleParticipantConstraints.js` (already used by Phase 1F). No extra helper file; no cycle.

---

## 12. Determinism

* ASCII / stable sorts only; no `localeCompare`, `Date.now`, `Math.random`, `randomUUID`.
* Rest state keys sorted; resource updates deterministic.
* Reversed match / resource input orders produce stable semantic outcomes under canonical sequence rules.

---

## 13. No-mutation evidence

Focused tests deep-clone ScheduleRequest before placement and assert equality afterward. Match participant arrays / resource id arrays are not rewritten by the scheduler beyond factory canonicalization at construction time.

---

## 14. Test traceability (scenarios 1–43)

| IDs | Test | Assertion group |
|--|--|--|
| 1–8 | `1E-R1-01..08 basic rest placement` | PLAYER/TEAM/ENTRY rest; disjoint; rest=0 touch; end vs capacityRelease |
| 9–12 | `1E-R1-09..12 multiple resources` | later resource; duplicates; order/normalization |
| 13–16 | `1E-R1-13..16 dependency interaction` | rest vs dep; max not sum; disjoint dependent |
| 17–21 | `1E-R1-17..21 capacity interaction` | capacity vs rest; concurrent; abstract ci |
| 22–26 | `1E-R1-22..26 windows and infeasibility` | session fit/advance; unscheduled; Phase 1F forge |
| 27–30 | `1E-R1-27..30 byes and unresolved identities` | bye skip; no display inference |
| 31–37 | `1E-R1-31..37 determinism and mutation` | replay; order; freeze; forbidden patterns |
| 38–43 | `1E-R1-38..43 Phase 1I blocker reproduction and handoff` | 08:45; HARD_CONSTRAINTS_CERTIFIED; FP; handoff SUCCESS |
| meta | `1E-R1 metadata: rest and overlap placement-enforced…` | certified vs deferred lists |
| R1-A | `1E-R1-A resource-kind rest policy matrix` | kind→policy; mixed bounds; Option A; order |
| R1-B | `1E-R1-B zero-rest overlap hard rule` | no overlap at rest=0; 1F certify/forge; not buffer |
| R1-C | `1E-R1-C Phase 1E/1F resource parity…` | normalization; max composition; no effectiveBuffer |

All scenarios: **PASS** (see verification section in return report).

---

## 15. Blocker fixture — before vs after

| | Before | After |
|--|--|--|
| m3 start | 08:30 | **08:45** |
| P1 rest gap | 0 min | **15 min** |
| Phase 1F | `HARD_CONSTRAINTS_REJECTED` | **`HARD_CONSTRAINTS_CERTIFIED`** |
| Phase 1H-B + CORE-12 (2 courts) | unreachable | **SUCCESS** (blocker removal only) |

---

## 16. Scope boundaries

Modified / created:

* `src/features/competition-core/schedule-engine/baselineScheduleCandidate.js`
* `src/features/competition-core/schedule-engine/scheduleDiagnostics.js` (comment only)
* `tests/competition-core-schedule-engine-core11-phase1e-r1-rest-aware-placement.test.js`
* `tests/competition-core-schedule-engine-core11-phase1e-baseline-scheduler.test.js` (test 49 metadata)
* `tests/competition-core-schedule-engine-core11-phase1f-constraint-certification.test.js` (C1-11 forge path)
* `docs/competition-engine/core-11/09_PHASE_1I_BLOCKER_REST_AWARE_PLACEMENT.md`

Not modified: CORE-09, CORE-10, CORE-12 core, integration runtime, Venue, civilTime, SQL/Supabase, UI, Phase 1I certification suite.

---

## 17. Remaining Phase 1I work

Phase 1I certification (tests + docs only) remains **not started**. Next document number after this blocker note should host final Phase 1I certification (e.g. `10_PHASE_1I_INTEGRATION_CERTIFICATION.md` or Owner-assigned).

Still out of Phase 1I until authorized:

* full failure matrix 1–32;
* fingerprint continuity suite;
* import/ownership static scans for Phase 1I;
* production orchestration helper (explicitly forbidden).

---

## 18. PR entry criteria

Ready for review when:

1. Phase 1E-R1 tests pass;
2. CORE-09 / CORE-11 / CORE-12 / Phase 1H-B focused suites remain green;
3. Blocker fixture certifies and hands off without time mutation;
4. Scope limited to authorized files;
5. No commit/push until Owner authorizes.
