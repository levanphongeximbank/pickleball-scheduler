# CORE-07 — Rule Engine Dependency Audit

**Phase:** 1A
**Baseline:** `fb9f482434639621d465cbc35b80e085fb82f383`
**CORE-01 SSOT:** `src/features/competition-core/constraints/**`
**CORE-01 docs:** `docs/competition-core/CORE01_*.md`

---

## 1. CORE-01 ownership (relevant to seeding)

CORE-01 = Competition Rule Engine Foundation (not historical CC-01 domain docs).

| Owns | Does not own |
|------|----------------|
| Authority ladder + deterministic rule resolution + traces | Registration lifecycle / eligibility orchestration (**CORE-03**) |
| Canonical operations including **`SEEDING`** and **`ELIGIBILITY`** | Competition seed ordering / assignment (**CORE-07**) |
| Hard/soft evaluation (`evaluateHardRules`, `validateEligibility`, `evaluateCanonicalRules`, …) | Division descriptors (**CORE-04**), roster SoT (**CORE-05**), lineup lifecycle (**CORE-06**) |
| Lookup ports (participant / entry / division interfaces) | Production UI / SQL / root barrel wiring |

Hard eligibility primitives already in CORE-01 include entry eligibility flags and gender eligibility (among others). Rating **ordering** is not a Rule Engine concern; rating **gates** are eligibility/registration concerns.

---

## 2. Current seeding ↔ Rule Engine coupling

| Surface | Coupling | Evidence |
|---------|----------|----------|
| `seeding/**` (Phase 3G) | **None (direct)** | No imports of `constraints/**` / `evaluateCanonicalRules` |
| `seed/**` (CC-04B) | **None** | Score pipeline only |
| Default policy | Structural | `createNoopSeedingPolicy` → `candidate.eligible !== false` |
| Resolver DI stubs | Declared, unused | `registrationResolver` / `participantResolver` / `teamResolver` in options JSDoc only |
| Error code | Reserved | `SEEDING_CANDIDATE_INELIGIBLE` exists; empty set fails as candidate-required path |

**Indirect sibling patterns (for alignment, not current seeding wiring):**

```text
CORE-03 ──DI facade──► CORE-01 evaluateCanonicalRules
CORE-04 ──port───────► CORE-01 eligibility evaluation
CORE-05 ──port───────► optional eligibility adapter → CORE-03/01
CORE-06 ──policy─────► format-injected filter (CORE-03 adjudicates eligibility)
seeding / seed ──────► NONE today
```

Phase 3G docs already forbid owning `teams/**`, `lineups/**`, `registrations/**` and treat Rule Engine as out of seeding ownership.

---

## 3. Rules duplicated outside CORE-01 that affect seeding

| Concern | Canonical owner | Parallel / duplicate today | Seeding behaviour |
|---------|-----------------|----------------------------|-------------------|
| Entry eligible flag | CORE-01 `entry_eligibility`; CORE-03 decisions | TE status set; 3G `eligible` boolean | Soft / local only |
| Gender / category | CORE-01 + CORE-04 descriptors + CORE-03 checks | Format engines | Not evaluated in seeding cores |
| Rating **gate** (min/max) | CORE-03 `RATING_RANGE` | None in seeding | Rating used as **order signal** only |
| Withdrawn / DQ / non-ACTIVE | CORE-03 participant status; CORE-05 roster statuses | Partial TE statuses | Not standardized in 3G / CC-04B |
| Capacity / payment / membership | CORE-03 | N/A | Out of seeding scope |
| Unseeded / new-player heuristic | TE only | Duplicates “eligibility-like” product rule | Must not become a second Rule Engine |

---

## 4. What CORE-07 should depend on vs must not own

### Should depend on (injected ports)

1. **SeedingEligibilityPort** (prefer CORE-03 evidence)
   `assertSeedable({ competitionId, contextId, candidate, operation: "SEEDING" })` → fail closed.

2. **Optional RuleEvaluationPort** (sibling of CORE-03 Phase 1E)
   Facade → `evaluateCanonicalRules(..., { operation: RULE_OPERATION.SEEDING })`.
   Contract version style: `core01-evaluateCanonicalRules-v1`.
   Use for hard seeding/entry rules — **not** ranking math.

3. **StatusSnapshotPort** (optional)
   Read withdrawn / DQ / ACTIVE snapshots; do not re-derive eligibility locally.

4. **SeedingPolicy** as Integrator/format adapter
   May call injected ports (mirror CORE-06 `LineupRandomPolicy.filterEligible`).

### Must not own / must not deep-import

- Rule authority, conflict detection, operation matching internals
- Registration orchestration / reason aggregation
- Division category descriptor evaluation
- Gender / age / sanction / rating-gate business rules
- Deep imports of `constraints/**` (facade/port only)
- Recalculation of rating / ranking

---

## 5. Risks if CORE-07 re-implements eligibility

1. **Split brain** — seeded withdrawn/DQ vs registration `INELIGIBLE`.
2. **Authority bypass** — tournament/club precedence ignored.
3. **Rating semantic drift** — order rating ≠ `RATING_RANGE` gate.
4. **Category drift** vs CORE-04 descriptors.
5. **Audit / evidence gap** — CORE-03 evidence not reused.
6. **Fail-open** — local “eligible by default” vs CORE-03 fail-closed.
7. **Operation mismatch** — applying `ELIGIBILITY`/`REGISTRATION` rules under `SEEDING` inconsistently.

---

## 6. Dependency audit verdict

| Question | Answer |
|----------|--------|
| Does existing CORE seeding call Rule Engine? | **No** |
| Is that a blocker for Phase 1B design? | **No** — Phase 1B should **specify** ports |
| Is that a blocker for production cutover? | **Yes** — must inject eligibility before any production wire |
| Recommended primary dependency | **CORE-03** admission decisions; optional CORE-01 for `SEEDING` operation |
| Recommended pattern | Same as CORE-03 Phase 1E: DI facades only |
