# Phase 3B — Canonical Court Descriptor Public Contract

**Status:** Implementation complete — awaiting Owner review (not committed)
**Date:** 2026-07-22
**Branch:** `feature/venue-court-phase-3b-canonical-descriptor-contract`
**Authorization:** `AUTHORIZE_VENUE_COURT_PHASE_3B_DESCRIPTOR_CONTRACT_IMPLEMENTATION_ONLY`

---

## 1. Contract purpose

Provide a stable, Venue-owned, Competition-facing public API that emits
`CanonicalCourtDescriptor` records from Club V3 court inventory.

This unblocks future CORE-12 provider injection without letting CORE-12 invent
inventory fields (`priority`, `capabilities`, authority, snapshot identity).

---

## 2. Ownership boundary

```text
Club V3 court inventory
  → Venue & Court inventory facade (listCourts)
  → listCanonicalCourtDescriptors(request)   ← this contract
  → future Competition integrator
  → CORE-12 (injected port only)
```

**Venue & Court owns:** descriptor authority, contract version, field mapping,
priority omission policy, diagnostics, scope fail-closed rules.

**Venue & Court does not own:** Competition assignment, Court Engine runtime,
CORE-12 projection validation, capability taxonomy.

**Forbidden reverse dependency:** this adapter must not import Competition Engine,
Court Engine repository modules, AI store, or fabricate revision metadata.

---

## 3. Public method

```javascript
listCanonicalCourtDescriptors(request)
```

Location:

* `src/features/venue-court/adapters/competitionCourtDescriptorAdapter.js`
* exported from `src/features/venue-court/index.js`
* constants: `src/features/venue-court/constants/descriptorContract.js`

---

## 4. Request shape

```javascript
{
  tenantId: string,       // required
  clubId: string,         // required
  venueId: string,        // required
  courtIds?: string[],    // optional filter
  clusterId?: string,     // optional filter only — never ownership
  includeInactive?: boolean, // default false
  includeLocked?: boolean    // default true
}
```

### Scope policy

* All of `tenantId`, `clubId`, `venueId` are required.
* No first-club fallback.
* No first-venue fallback.
* No ambient tenant fallback.
* `clusterId` filters inventory only; it never establishes ownership.

### Listing defaults

| Flag | Default | Meaning |
|------|---------|---------|
| `includeInactive` | `false` | Inactive courts omitted |
| `includeLocked` | `true` | Locked courts may appear with `locked: true` |

---

## 5. Response shape

```javascript
{
  tenantId,
  clubId,
  venueId,
  descriptorAuthority,
  sourceContractVersion,
  sourceSnapshotId,      // always null in Phase 3B
  sourceSnapshotVersion, // always null in Phase 3B
  courts: [
    {
      courtId,
      tenantId,
      clubId,
      venueId,
      active,
      locked,
      capabilities, // always []
      priority      // explicit finite number from inventory only
    }
  ],
  diagnostics: {
    excludedCourts: [
      { courtId, reason }
    ]
  }
}
```

---

## 6. Field semantics

| Field | Mapping |
|-------|---------|
| `courtId` | `court.id` |
| `tenantId` / `clubId` / `venueId` | echoed from verified request scope |
| `active` | `court.active !== false` |
| `locked` | `court.status === "locked"` only (maintenance is **not** locked) |
| `capabilities` | always `[]` (Venue-certified empty set for Phase 3B) |
| `priority` | only when inventory has an explicit own finite numeric `priority` |

---

## 7. Priority omission policy (fail-closed)

* Do **not** derive priority from array index, court number, display order, or name.
* Do **not** silently default priority to `0` and claim Venue authority.
* Emit a descriptor **only** when inventory contains an explicit valid finite numeric `priority` own-property.
* Courts lacking authoritative priority are omitted.
* Diagnostic reason: `PRIORITY_NOT_AUTHORITATIVE`.
* Phase 3B does **not** modify `src/models/court.js`, add UI, or create a migration.
* Note: current `normalizeCourt` does not persist `priority`. Until a later Owner-approved persistence phase, real Club V3 writes typically omit priority and therefore omit descriptors under this policy. Tests inject priority via inventory facade deps.

---

## 8. Diagnostics

```javascript
diagnostics: {
  excludedCourts: [
    { courtId: string, reason: string }
  ]
}
```

Required reasons in Phase 3B:

* `PRIORITY_NOT_AUTHORITATIVE` — court passed listing flags but priority is missing/invalid
* `COURT_NOT_FOUND` — requested `courtIds` entry not present in scoped inventory

Order is deterministic (processing order of inventory or requested `courtIds`).

A valid empty `courts: []` with diagnostics is **not** a load failure.

---

## 9. Authority and version literals

Exact Venue-owned constants:

```text
descriptorAuthority:
venue-court.inventory.club_data_v3

sourceContractVersion:
VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1
```

Exported as `DESCRIPTOR_AUTHORITY` and `SOURCE_CONTRACT_VERSION`.

---

## 10. Nullable snapshot semantics

Always:

```text
sourceSnapshotId: null
sourceSnapshotVersion: null
```

Do not generate UUIDs, timestamps, or hashes. Do not fabricate revision metadata.

---

## 11. Descriptors vs availability

| Contract | Role |
|----------|------|
| `listCanonicalCourtDescriptors` | Inventory identity + Venue-certified descriptor fields |
| `getCompetitionCourtAvailability` | Eligibility / free-window IDs only |

Do **not** add descriptor payloads to CAA. Do **not** redefine CAA response shape.

Locked courts may appear in descriptors (`locked: true`). CORE-12 must fail-close assignment eligibility separately via CAA / eligibility port.

---

## 12. Ordering

* Default listing: preserve deterministic inventory order after filters.
* When `courtIds` is supplied: preserve requested `courtIds` order among valid matched descriptors.

---

## 13. Fail-closed errors

Throw (do not convert to successful empty) for:

* missing / invalid `tenantId`, `clubId`, `venueId`
* club not found
* venue mismatch
* tenant mismatch
* inventory / club load failure
* invalid request object / `courtIds` / boolean flags / `clusterId` type

Error codes: `DESCRIPTOR_ERROR` in `descriptorContract.js`.

---

## 14. Integration rule for future CORE-12

CORE-12 must consume this contract only through an Owner-approved injected port
(for example `CanonicalCourtDescriptorProvider` wrapping
`listCanonicalCourtDescriptors`). CORE-12 must not deep-import Club V3 storage
or invent descriptor fields.

Wiring into CORE-12 is **out of scope** for Phase 3B.

---

## 15. Backward compatibility

Additive only. Unchanged:

* `listCourts` / `getCourtById`
* `getCourtAvailability`
* `getCompetitionCourtAvailability`
* booking behavior
* Competition Phase 2 wiring
* HTTP `/courts` response shape

---

## 16. Explicit out of scope

* CORE-12 provider implementation / injection wiring
* Competition Engine / Court Engine changes
* Priority persistence model / migration / UI
* Capability taxonomy beyond empty `[]`
* Snapshot / revision generation
* SQL apply, deploy, commit, push, PR
