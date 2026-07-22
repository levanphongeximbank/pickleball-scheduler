# CORE-14 Phase 1A — Resource Conflict Resolver Audit

**Module:** Competition Engine — Resource Conflict Resolver (CORE-14)
**Branch:** `feature/competition-core-14-resource-conflict-resolver`
**Phase:** 1A — Audit (Owner-approved)
**Owner verdict:** `CORE_14_PHASE_1A_APPROVED`
**Status:** Documentation freeze artifact only — no runtime implementation
**Date:** 2026-07-22

---

## 1. Purpose

Record the Phase 1A audit baseline that authorized Phase 1B contract freeze documentation.

Phase 1A confirmed that CORE-14 must become a **pure detection / classification / recommendation / dry-run validation** capability with strict ownership boundaries against adjacent scheduling cores and Venue & Court.

---

## 2. Official adjacent ownership map (audited)

| Core | Name | Relationship to CORE-14 |
|------|------|-------------------------|
| CORE-09 | Match Generator | Upstream logical matches; not a conflict owner |
| CORE-10 | Global Optimizer | Consumer of hard/soft findings and candidate moves |
| CORE-11 | Schedule Engine | Supplier of time occupancies; consumer of time/rest findings |
| CORE-12 | Court Assignment | Supplier of court occupancies; consumer of court findings |
| CORE-13 | Referee Assignment | Supplier of referee occupancies; consumer of referee findings |
| CORE-14 | Resource Conflict Resolver | This module |

Venue & Court remains the **canonical availability / blackout / capacity source of truth**, consumed only through a neutral port.

---

## 3. Audit findings (accepted)

### 3.1 Ownership gaps

1. No dedicated CORE-14 module path or contracts existed under `docs/competition-engine/core-14/` or `src/features/competition-core/resource-conflict/`.
2. Conflict semantics must not be redefined inside CORE-10, CORE-11, CORE-12, CORE-13, or product UI.
3. Availability must not be imported from Venue & Court internal implementation.

### 3.2 Identity risks

1. Resource identity must be independent of time windows.
2. Scope must not be inferred from the first input record.
3. Resource IDs must be externally supplied, stable, and non-empty.
4. Silent identity invent/transform is forbidden.

### 3.3 Time risks

1. Domain time must be JavaScript-safe integer epoch milliseconds (`Number.isSafeInteger(startMs/endMs)`), not `string | number`.
2. ISO / local civil / timezone / `slotId` belong in adapters only.
3. Half-open interval `[startMs, endMs)` and adjacent non-overlap (`endA === startB`) must be frozen.
4. Implicit duration is unsafe; explicit default duration requires versioned policy + diagnostic.

### 3.4 Finding / severity risks

1. Generic and specialized codes must not double-emit for the same root cause.
2. Same `venueId` alone must not create a conflict.
3. HARD minimum severity must be caller-raise-only (never lowerable).
4. Input validation diagnostics are not resource conflicts.

### 3.5 Evaluation envelope risks

1. A single `ok` boolean overloads evaluation completion and plan validity.
2. Provider failure in authoritative mode must fail closed (`DATA_UNAVAILABLE` / `NOT_EVALUATED`).
3. Recommendations must be structured deltas only; CORE-14 must never apply them.

### 3.6 Determinism risks

Forbidden in identity / fingerprint material:

- `Date.now()`
- `Math.random()`
- input order as identity
- locale-dependent comparison
- database row order
- unstable JSON serialization

---

## 4. Explicit non-goals confirmed in Phase 1A

CORE-14 does **not** own:

- match generation
- schedule generation
- court assignment
- referee assignment
- inventory of players, teams, courts, venues, locations, referees, or equipment
- availability source of truth
- persistence / SQL
- UI / workflow / notifications
- deployment
- global optimization

---

## 5. Phase 1A exit condition

Owner accepted Phase 1A and Phase 1A-R remediation, then authorized:

`AUTHORIZE_CORE_14_PHASE_1B_CONTRACT_FREEZE_DOCS_ONLY`

See [00B_PHASE_1A_R_REMEDIATION.md](./00B_PHASE_1A_R_REMEDIATION.md).
