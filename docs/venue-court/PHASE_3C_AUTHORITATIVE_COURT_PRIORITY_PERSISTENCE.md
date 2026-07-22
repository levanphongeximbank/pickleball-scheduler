# Phase 3C — Authoritative Court Priority Persistence

**Status:** Implementation complete — awaiting Owner review (not committed)
**Date:** 2026-07-22
**Branch:** `feature/venue-court-phase-3c-priority-persistence`
**Authorization:** `AUTHORIZE_VENUE_COURT_PHASE_3C_PRIORITY_PERSISTENCE_IMPLEMENTATION_ONLY`
**Policy:** Policy A — Explicit persisted priority

---

## 1. Purpose

Persist an optional Venue-owned `court.priority` so Phase 3B
`listCanonicalCourtDescriptors` can emit courts with authoritative priority
after Club V3 save/load and cloud-compatible blob normalization.

This phase does **not** invent priority, backfill data, add UI, change HTTP
`GET /courts`, or apply SQL.

---

## 2. Ownership

```text
Venue & Court owns court.priority
  → normalizeCourt / normalizeCourts
  → Club V3 courts[] persistence (saveCourtsForClub / loadCourtsForClub)
  → listCourts / getCourtById (optional field passthrough)
  → listCanonicalCourtDescriptors (Phase 3B consumer)
  → future CORE-12 (injected consumer only)
```

**CORE-12 remains a consumer only.** Competition Engine and Court Engine must
not become sources of priority.

---

## 3. Validity rule

Valid only when:

```text
typeof priority === "number" && Number.isFinite(priority)
```

Examples preserved:

* `10`
* `1.5`
* `0` (only when explicitly supplied)
* `-2`

Omitted (property absent on normalized output):

* missing / `undefined` / `null`
* `"10"` (no string coercion)
* `NaN` / `Infinity` / `-Infinity`
* object / array

Normalization must **not**:

* default to `0`
* use `Number(value)`, `parseInt`, or `parseFloat` for priority
* infer from array index, court number, name, display order, creation order,
  availability, Court Engine, or Competition Engine state

---

## 4. Persistence path

```text
explicit court.priority
  → normalizeCourt
  → normalizeCourts
  → saveCourtsForClub / saveClubData (normalizeClubData)
  → club_data_v3 JSON blob
  → loadCourtsForClub / loadClubData
  → listCourts / getCourtById
```

`upsertCourt` forwards `extra.priority` only when the property is explicitly
present. Editing without supplying priority keeps any existing finite priority.
Invalid explicit priority fails closed by omission.

---

## 5. Phase 3B descriptor integration

Unchanged contract behavior:

* finite explicit inventory priority → descriptor emitted with same value
* absent / invalid priority → court omitted with
  `PRIORITY_NOT_AUTHORITATIVE`

After Phase 3C, a court saved with finite priority can be listed by
`listCanonicalCourtDescriptors` with that exact priority.

---

## 6. Backward compatibility

Existing court records without `priority`:

* normalize successfully
* save / load successfully
* remain visible to `listCourts` / availability / booking flows
* remain excluded only from canonical Competition descriptors

No Production backfill. No mutation of legacy data in this phase.

---

## 7. Explicit non-goals

* No priority UI controls
* No HTTP `GET /courts` response schema change
* No write API for priority
* No SQL migration / apply
* No Competition Engine or Court Engine imports
* No CORE-12 implementation

---

## 8. Files

| Path | Role |
|------|------|
| `src/models/court.js` | Preserve optional finite priority in `normalizeCourt` |
| `src/pages/courts.logic.js` | Pass through explicit `extra.priority` only |
| `tests/models.test.js` | Normalization lock tests |
| `tests/venue-court/court-priority-persistence.test.js` | Persistence / facade / descriptor coverage |
| `src/features/venue-court/README.md` | Phase 3C status pointer |
