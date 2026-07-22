# CORE-12 Phase 1D-B2 — Venue Provider Authority Audit

| | |
|--|--|
| **Phase** | **1D-B2 — authoritative descriptor source audit** |
| **Date** | 2026-07-22 |
| **HEAD base** | `aaa603cd…` (= `origin/main` / merged Phase 1D-B1 PR #156) |
| **Branch** | `feature/competition-core-12-phase-1d-b2-venue-provider` |
| **Selected option** | **OPTION B** |
| **Verdict** | `BLOCKED_AUTHORITATIVE_DESCRIPTOR_PUBLIC_CONTRACT` |
| **Production provider** | **Not implemented** (correct fail-closed outcome) |

---

## 1. Scope statement

Phase 1D-B2 audited whether an independently authoritative canonical court descriptor source already exists and, **only if** a sufficient public contract existed without modifying Venue & Court, would implement an injected Venue CAA provider inside CORE-12.

**Result:** authoritative inventory **exists** under Venue & Court, but **no stable public Competition-facing contract** exposes the `CanonicalCourtDescriptor` shape required by Phase 1D-B1. CORE-12 therefore **must not** ship a production provider that invents or silently maps incomplete inventory records into descriptors.

---

## 2. Selected authority option

**OPTION B — EXISTING SOURCE NEEDS A NARROW PUBLIC CONTRACT**

| Claim | Status |
|-------|--------|
| Independently authoritative inventory provenance exists | **Yes** — Club V3 courts via Venue `listCourts` / availability load path |
| Stable public contract exposes required descriptor shape | **No** |
| CORE-12 may fabricate missing descriptor fields | **Forbidden** |
| CORE-12 may modify Venue & Court in this phase | **Forbidden** |
| Production injected Venue CAA provider | **Deferred** until upstream contract lands |

Stop code: **`BLOCKED_AUTHORITATIVE_DESCRIPTOR_PUBLIC_CONTRACT`**

---

## 3. Exact authoritative source (inventory, not descriptor contract)

| Layer | Module | Export | Role |
|-------|--------|--------|------|
| Inventory facade | `src/features/venue-court/services/courtInventoryService.js` | `listCourts`, `getCourtById` | Production inventory read; public via `venue-court/index.js` |
| Canonical availability | `src/features/venue-court/services/courtAvailabilityService.js` | `getCourtAvailability` | Loads inventory + bookings + hours; embeds `toCourtPublic(court)` |
| Competition CAA | `src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js` | `getCompetitionCourtAvailability` | Competition eligibility IDs only |
| Domain model | `src/models/court.js` | `normalizeCourt` | Master shape: `id`, `name`, `number`, `active`, `status`, rates, optional `tenantId`/`clusterId` |
| HTTP slice | `src/features/api/router/handlers/courtsHandler.js` | `handleCourtsList` | `{ id, name, number, active }` only |

**Owning capability:** Venue & Court Management (not CORE-12).

---

## 4. Dependency direction

```text
Allowed (future, after upstream contract):
  Integrator / host
    → injects VenueEligibilityProvider (wraps CAA)
    → injects CanonicalCourtDescriptorProvider (wraps NEW Venue public descriptor contract)
    → CORE-12 consumer-side AvailabilitySnapshotProvider / bridge
    → projectEligibleCourtsToAvailableInputs
    → assignCourtsDeterministic

Forbidden now:
  CORE-12 hard-importing domain/courtService, clubStorage, Supabase
  CORE-12 inventing CanonicalCourtDescriptor fields from eligibility IDs
  Venue & Court importing CORE-12
  TE / CORE-11 / CORE-14 wiring in this phase
```

Hard-importing `listCourts` into CORE-12 would be directionally acyclic but **still invalid** for Phase 1D-B2 because:

1. Architecture prefers Integrator-injected ports (`05_INTEGRATION_BOUNDARIES.md`, 1D-A2 §19.12).
2. Raw inventory / `toCourtPublic` is **not** the required descriptor contract.
3. Mapping would fabricate `capabilities`, `priority`, `descriptorAuthority`, scoped `clubId`/`venueId`/`tenantId` on records, and source identity.

---

## 5. Why Option A is rejected

Phase 1D-B1 `CanonicalCourtDescriptor` requires at minimum:

| Field | `listCourts` raw | `toCourtPublic` | CAA out | Sufficient? |
|-------|------------------|-----------------|---------|-------------|
| `courtId` | `id` | `id` | id only | ID only |
| `tenantId` | optional / often absent | absent | absent | **No** |
| `clubId` | not on court record | absent | echo on response, not per-court descriptor | **No** |
| `venueId` | not on court record | absent | nullable echo | **No** |
| `active` | yes | yes | absent | Partial |
| `locked` | via `status === "locked"` only | via `status` | eligibility exclusion only | **No explicit contract field** |
| `capabilities` | absent | absent | absent | **No** |
| `priority` | absent | absent | absent | **No** (default `0` is not Venue truth) |
| `descriptorAuthority` / `sourceContractVersion` | absent | absent | absent | **No** |
| `sourceSnapshotId` / version | absent | static `source` labels only | absent | Must remain **null** if absent |

Eligibility IDs are **not** inventory descriptors. Structural `createCanonicalCourtDescriptor` validation is **not** independently verified authority.

---

## 6. Exact required upstream public contract

Venue & Court (or Owner-approved Integrator adapter backed by Venue) must expose a **stable, versioned, Competition-facing** descriptor provider contract. Recommended shape (consumer-side name may be `CanonicalCourtDescriptorProvider`):

### 6.1 Query (exact scope)

```text
{
  tenantId,          // required stable id
  clubId,            // required
  venueId,           // required
  courtIds?,         // optional filter; when set, result must be subset
  clusterId?,        // optional
  includeInactive?,  // default false
  includeLocked?     // default true for descriptor listing (projection still fail-closes locked)
}
```

### 6.2 Output — one descriptor per court (deterministic order)

```text
{
  sourceContractVersion,   // required non-empty Venue-owned pin (never invented by CORE-12)
  descriptorAuthority,     // required non-empty Venue-owned authority id
  sourceSnapshotId,        // nullable; omit/null when Venue has none — never fabricate
  sourceSnapshotVersion,   // nullable; same rule
  courts: [
    {
      courtId,             // required
      tenantId,            // required; must match query
      clubId,              // required; must match query
      venueId,             // required; must match query
      active,              // required boolean
      locked,              // required boolean (inventory lock; not TE manual lock)
      capabilities,        // required: [] or Venue-owned map/array — never invented by CORE-12
      priority             // required finite number owned by Venue, OR explicitly documented
                           // as "absent → omit court from competition descriptor set"
                           // (CORE-12 must not silently default and claim Venue truth)
    }
  ]
}
```

### 6.3 Semantics Venue must certify

1. Inventory provenance is Club V3 / Venue SSOT (or successor), not TE/CE/UI reconstructed lists.
2. Exact tenant/club/venue scoping; mismatch fails closed.
3. Deterministic ordering (stable id / inventory order — documented).
4. No fabricated snapshot ids.
5. Sync or Promise allowed; CORE-12 will await via injected port only.
6. Public export from `venue-court` (or approved Integrator module) — not deep `domain/` imports for CORE-12.
7. CAA may remain ID-only; descriptors may be a **separate** public export (preferred) **or** an additive CAA field set authorized by Venue Owner.

### 6.4 Eligibility dependency (already exists, injectable)

`getCompetitionCourtAvailability` remains the eligibility source. CORE-12 may wrap it behind a consumer-side `VenueEligibilityProvider` **after** the descriptor contract exists — without modifying Venue if injection is used.

---

## 7. Provider construction (deferred)

Not implemented. Future construction (after Option A becomes true):

```text
createInjectedVenueCourtAvailabilityProvider({
  resolveEligibility,   // VenueEligibilityProvider
  resolveDescriptors,   // CanonicalCourtDescriptorProvider
})
```

Must:

- accept `AvailabilityEligibilityQuery`;
- validate exact scope/window;
- call injected eligibility + descriptor deps;
- normalize; preserve genuine source snapshot ids; leave null when absent;
- reject scope/dupes/missing/inactive/locked/capability failures;
- project eligibility ∩ descriptors with exactly one interval = query window;
- preserve empty eligibility;
- emit deterministic findings/fingerprints;
- map upstream errors to CORE-12 bridge codes;
- perform no retries/timeout/cache/persistence unless a public contract authorizes them.

---

## 8. Source and derived identity

| Field | Rule (unchanged from 1D-B1) |
|-------|-----------------------------|
| `sourceSnapshotId` / `sourceSnapshotVersion` | Nullable; **never fabricated** |
| Derived fingerprints | Required; labeled derived |
| Declared `descriptorAuthority` | Must come from upstream contract, not CORE-12 invention |

---

## 9. Exact-window / empty / fail-closed

Unchanged from Phase 1D-B1:

- One absolute half-open interval equal to the query window.
- Overnight / cross-midnight unsupported.
- Empty eligibility → valid empty projection + `EMPTY_ELIGIBILITY_RESULT`.
- Locked descriptors fail closed (`COURT_DESCRIPTOR_LOCKED`).
- No unrestricted fallback from eligibility IDs alone.

---

## 10. Export inventory (this phase)

| Surface | Change |
|---------|--------|
| `court-assignment/index.js` | **Unchanged** (no production Venue provider) |
| `adapters/availability/index.js` | **Unchanged** |
| Root `competition-core/index.js` | **Unchanged** |
| New production provider modules | **None** |
| Test doubles in production barrels | **None** |
| Docs | This file |
| Tests | `tests/competition-core-court-assignment-core12-phase1d-b2.test.js` (authority lock / audit) |

---

## 11. Explicit non-goals (confirmed)

No Tournament Engine wiring; no CORE-11; no CORE-14; no UI; no SQL; no Supabase; no persistence; no deployment; no runtime cutover; no Venue & Court source edits in this phase; no commit/push/PR from this agent pass.

---

## 12. Remaining blockers

1. **Hard:** Venue (or Owner-approved Integrator) must publish the §6 descriptor public contract.
2. Soft: optional Venue `sourceSnapshotId` / version for audit correlation.
3. Soft: whether capabilities/priority are Venue-owned inventory fields or remain Integrator-owned (must be explicit; CORE-12 will not invent).
4. After contract: implement injected provider + full Phase 1D-B2 behavioral matrix inside CORE-12 only.

---

## 13. Recommended next action

Owner / Venue & Court Owner:

1. Approve §6 as the minimal public descriptor contract **or** authorize an additive CAA descriptor payload.
2. Implement and certify that contract upstream (out of CORE-12 ownership).
3. Re-open Phase 1D-B2 implementation as Option A on a fresh clean tree from then-current main.

Until then, CORE-12 remains on Phase 1D-B1 foundation only.
