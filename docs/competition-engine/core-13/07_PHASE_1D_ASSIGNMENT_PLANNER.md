# CORE-13 — Phase 1D Assignment Planner

**Module:** `engines/assignReferees.js`, `engines/replaceRefereeAssignment.js`
**Schema:** `CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1`

---

## 1. Phase 1C mandatory corrections

### Fairness

```text
fairnessDelta = abs(activeAssignmentCount * refereePopulationSize - totalActiveAssignmentCount)
fairnessScale = refereePopulationSize
```

Symmetric around the exact population mean without floating-point means.

### Affiliation conflicts

Flags (default **false**):

- `disallowAffiliatedTeamReferee`
- `disallowAffiliatedClubReferee`
- `disallowAffiliatedOrganizationReferee`

Hard by default: participant COI, explicit exclusions, explicit prohibited lists, self-referee denial.
General affiliation → hard only when the corresponding flag is true; otherwise optional soft note (`AFFILIATED_*`).

### Soft notes

Canonical enum `REFEREE_SOFT_NOTE_CODE` — codes required; messages never replace codes.

---

## 2. Planner I/O

**`assignReferees(input)`** → `{ ok, plan, failure }`

Inputs: request, policy, directory/qualification/availability/existing/schedule snapshots, conflict policy, optional history.

**`replaceRefereeAssignment(input)`** → replacement result with REPLACED prior + incoming REPLACEMENT assignment (or failure).

---

## 3. Fatal vs recoverable

| Case | Behavior |
|------|----------|
| Missing/invalid required snapshot | Fatal `RefereeAssignmentFailure` |
| Valid empty directory | Valid plan with unassigned requirements |
| Single match unassignable | Recoverable unassigned row; other matches continue |

---

## 4. Ordering

**Matches:** `scheduleOrder` → `startAt` → `endAt` → `matchId`
**Requirements:** mandatory first → priority → `roleCode` → index
**Slots:** `slotIndex` ascending from 0

---

## 5. Hard eligibility gate

Reuses `evaluateRefereeEligibility` / conflicts / workload. Soft scores never compensate hard failures. Newly planned assignments feed later overlap/capacity/workload.

---

## 6. Soft objectives (lexicographic, lower-is-better)

`WORKLOAD_BALANCE`, `CONSECUTIVE_MATCH_MINIMIZATION`, `COURT_TRANSITION_MINIMIZATION`, `ROLE_PREFERENCE`, `EXPERIENCE_PREFERENCE`, `DIVISION_FAMILIARITY`, `AFFILIATION_NEUTRALITY`, `ASSIGNMENT_CONTINUITY`

Final tie-break: optional seeded key → `refereeId` (`compareStableString`).
Missing seed allowed unless `requireSeed`; no ambient RNG.

---

## 7. ANY role

Matcher only. Emit concrete role from qualifications (+ preferredConcreteRoles). Never emit `ANY` on `RefereeAssignment`.

---

## 8. Identities & fingerprints

Authoritative digests use **SHA-256** (`CORE13_DIGEST_SHA256_V1`) with domain separation.

- Full fingerprints: 64-char lowercase hex
- IDs: `core13_assignment_v1_` / `core13_plan_v1_` / `core13_replacement_v1_` + ≥128-bit truncation
- Excludes wall-clock, audit timestamps, free-text messages, non-authoritative `displayLabel`
- FNV-1a is **not** used for identities or fingerprints

---

## 9. Newly planned state

Isolated projection; does not mutate caller snapshots. Deeply immutable public results.

---

## 10. Replacement

Prior must be PLANNED/CONFIRMED. Same referee rejected by default. Outgoing ignored only for target overlap/capacity. Preserve matchId + roleCode. Source=`REPLACEMENT`. Audit payload without `recordedAt`. Fingerprint ignores sink timestamps.

---

## 11. CORE-14 boundary

Referee conflict projections remain CORE-13-owned facts. No CORE-14 imports.

---

## 12. Deferred

Persistence, adapters, UI, root barrel integration, Schedule/Court/Match Lifecycle modifications.
