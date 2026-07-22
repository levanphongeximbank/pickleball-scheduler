# CORE-14 — Phase 1C Final Contract Corrections

**Contract family:** `core14-phase-1c-final-corrections-v1`
**Phase:** 1C — Dormant Domain Foundation
**Status:** Frozen (Owner-authorized)
**Date:** 2026-07-22
**Authorization:** `AUTHORIZE_CORE_14_PHASE_1C_DORMANT_DOMAIN_FOUNDATION`
**Prior verdict:** `CORE_14_PHASE_1B_APPROVED`

These decisions supersede conflicting Phase 1B / 1B-S wording where noted.

---

## 1. EVENT scope identity

- `CanonicalResourceKey.scopeId` is the **canonical event identity** when `scopeType = EVENT`.
- Do **not** add a second canonical event identity field to `ResourceOccupancy`.
- An adapter may receive `eventId`.
- If both adapter `eventId` and `scopeId` are supplied, they must match **exactly** (UTF-8 code-unit equality; no trim / case / Unicode normalize).
- Mismatch fails closed with **`SCOPE_IDENTITY_MISMATCH`**.

---

## 2. Capacity V1

- `capacityUnits` must satisfy `Number.isSafeInteger(capacityUnits)`.
- `capacityUnits` must be **greater than zero**.
- Resource capacity limits used by capacity checking must also be safe integers greater than zero.
- Fractional capacity is **unsupported** in CORE-14 V1.
- Invalid capacity → **`INVALID_CAPACITY`**.
- Missing capacity where required → **`CAPACITY_MISSING`**.

---

## 3. LogicalAssignmentKeyV1

```text
LogicalAssignmentKeyV1 {
  resourceKey: CanonicalResourceKey   // via CORE14_CRK_V1 serialization in key material
  activityIdentityType: ASSIGNMENT_ID | ACTIVITY_ID | MATCH_ID
  activityIdentityValue: string       // non-empty; exact caller bytes
}
```

Activity identity precedence (first non-empty string wins):

1. `assignmentId`
2. `activityId`
3. `matchId`

Rules:

- `resourceKey` is part of logical assignment identity.
- `source` is **provenance only** and must **not** conceal duplicates.
- Adapters must namespace-qualify externally non-unique IDs before CORE-14 entry.
- Same `occupancyId` repeated → **`DUPLICATE_OCCUPANCY_ID`**.
- Different `occupancyId`s with the same `LogicalAssignmentKeyV1` → **`DUPLICATE_ASSIGNMENT`**.
- When both descriptions could apply, **`DUPLICATE_OCCUPANCY_ID` has primary precedence**.

Serialization version: **`CORE14_LAK_V1`**.

---

## 4. Severity constants (Phase 1C foundation)

Frozen severity constants:

- `HARD`
- `SOFT`
- `INFO`

Finding minimum-severity policy for V1 continues to use `HARD` / `SOFT` only.
`INFO` is reserved for future versioned emission and must remain an immutable constant.

Raise-only override evaluation remains:

- `SOFT` may be raised to `HARD`
- `HARD` may not be lowered
- Attempted downgrade retains minimum severity and emits **`SEVERITY_DOWNGRADE_REJECTED`**

---

## 5. Phase 1C implementation scope reminder

Authorized runtime path:

- `src/features/competition-core/resource-conflict/`
- `tests/competition-core-resource-conflict-core14-phase1c.test.js`
- Docs under `docs/competition-engine/core-14/`

Module remains **dormant and unwired**. No root `competition-core/index.js` export.
