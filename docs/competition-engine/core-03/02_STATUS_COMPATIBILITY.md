# CORE-03 Phase 1A — Status Compatibility Boundary

**Status:** Phase 1A documentation only — no enum aliasing, no Core-02 / Phase-3C edits  
**Module:** `src/features/competition-core/registration-eligibility/`  
**Related:** `docs/competition-engine/core-03/00_REGISTRATION_ELIGIBILITY_ARCHITECTURE.md`

---

## 1. Three distinct status spaces

| Space | Owner | Object | Purpose |
|-------|-------|--------|---------|
| **Core-03 `REGISTRATION_STATUS`** | Core-03 | Competition **registration application** lifecycle | Submit / review / decide / waitlist / withdraw |
| **Core-02 `COMPETITION_ENTRY_STATUS`** | Core-02 | Competition **Entry** (competing unit) | Draft → approved/active competing unit after persistence |
| **Phase 3C / Core-02 shadow `COMPETITION_REGISTRATION_STATUS`** | Legacy / Core-02 typedef | Thin registration shadow used by Phase 3C resolve runtime | Includes `PENDING`; **not** mutated in Core-03 Phase 1A |

These are **not** the same object. Sharing a string label (e.g. `APPROVED`, `DRAFT`) does **not** imply identity or automatic conversion.

---

## 2. Non-negotiable rules (Phase 1A)

1. **Core-03 registration status ≠ Core-02 Entry status.**  
   A registration application and an Entry are different aggregates with different owners and transition policies.

2. **`APPROVED` registration does not mean an Entry already exists.**  
   Approval is a registration-lifecycle terminal decision. Entry persistence happens only when a later application service invokes **`EntryCreationPort.createEntryFromRegistration`** and Core-02 accepts the handoff.

3. **`EntryCreationPort` owns the approved-registration → Entry handoff contract.**  
   Core-03 Phase 1A defines the port + in-memory stub only. No Production adapter. No silent Entry creation inside transition helpers.

4. **Legacy `PENDING` remains untouched.**  
   Phase 3C `registrations/**` and Core-02 `COMPETITION_REGISTRATION_STATUS.PENDING` are **not** edited in Phase 1A. Core-03 uses `UNDER_REVIEW` (and adds `CONDITIONAL`, `EXPIRED`) on its **local** enum.

5. **No direct enum aliasing.**  
   Do not `export { COMPETITION_REGISTRATION_STATUS as REGISTRATION_STATUS }`, do not mutate sibling enums, and do not treat `PENDING === UNDER_REVIEW` in code unless a later **explicit, versioned** compatibility decision approves it.

6. **Future mapping must be explicit, versioned, deterministic, and auditable.**  
   Any bridge (e.g. Phase 3C ↔ Core-03, or Registration APPROVED ↔ Entry create) must:
   - live in a named adapter/mapper with a version string;
   - use a fixed lookup table (no fuzzy coerce);
   - fail closed on unknown statuses;
   - emit audit evidence (from/to, mapper version, registrationId, optional entryId).

---

## 3. Compatibility matrix (documentation — not implemented)

### 3.1 Core-03 registration ↔ legacy / Core-02 registration shadow

| Core-03 `REGISTRATION_STATUS` | Phase 3C / Core-02 shadow `COMPETITION_REGISTRATION_STATUS` | Phase 1A rule |
|-------------------------------|-------------------------------------------------------------|---------------|
| `DRAFT` | `DRAFT` | Label-compatible; **no shared enum** |
| `SUBMITTED` | `SUBMITTED` | Label-compatible; **no shared enum** |
| `UNDER_REVIEW` | *(no exact twin; closest historical label `PENDING`)* | **Do not alias.** Mapper deferred |
| `CONDITIONAL` | *(absent)* | Core-03-only until adapter phase |
| `WAITLISTED` | `WAITLISTED` | Label-compatible; waitlist remains Registration-owned (OD-10) |
| `APPROVED` | `APPROVED` | Label-compatible; **does not create Entry** |
| `REJECTED` | `REJECTED` | Label-compatible |
| `WITHDRAWN` | `WITHDRAWN` | Label-compatible |
| `CANCELLED` | `CANCELLED` | Label-compatible |
| `EXPIRED` | *(absent)* | Core-03-only until adapter phase |
| *(n/a)* | `PENDING` | **Legacy only — leave untouched** |

### 3.2 Core-03 registration ↔ Core-02 Entry

| Core-03 registration event | Core-02 Entry effect (Phase 1A) | Notes |
|----------------------------|----------------------------------|-------|
| Any non-`APPROVED` status | **None** | No Entry write |
| Transition → `APPROVED` | **None automatically** | Sets registration terminal only |
| Later call to `EntryCreationPort` after `APPROVED` | May create Entry (Core-02) | Adapter / Phase 1B+ responsibility |
| Entry `APPROVED` / `ACTIVE` | Independent Entry lifecycle | Not a registration reopen |

### 3.3 Eligibility outcomes (Core-03) vs registration status

| `ELIGIBILITY_OUTCOME` | Typical registration direction (policy, not auto-applied in 1A) |
|-----------------------|------------------------------------------------------------------|
| `ELIGIBLE` | May proceed toward approve / waitlist per capacity |
| `INELIGIBLE` | May drive `REJECTED` |
| `CONDITIONAL` | May drive `CONDITIONAL` |
| `MANUAL_REVIEW_REQUIRED` | May keep / move to `UNDER_REVIEW` |

Eligibility aggregation helpers in Phase 1A **do not** mutate registration status by themselves.

---

## 4. Deferred work (not Phase 1A)

- Versioned mapper: Phase 3C / Core-02 shadow ↔ Core-03 `REGISTRATION_STATUS`
- Production `EntryCreationPort` adapter
- Integrator decision on whether official CI manifest lists Core-03 tests (see Condition 1 note in completion report)

---

## 5. Evidence pointers

| Item | Path |
|------|------|
| Core-03 statuses | `registration-eligibility/enums/registrationStatus.js` |
| Core-02 Entry statuses | `participants/enums/statuses.js` → `COMPETITION_ENTRY_STATUS` |
| Legacy registration statuses | `participants/enums/statuses.js` → `COMPETITION_REGISTRATION_STATUS` (includes `PENDING`) |
| Entry handoff port | `registration-eligibility/ports/entryCreationPort.js` |
| Phase 3C runtime (untouched) | `src/features/competition-core/registrations/**` |
