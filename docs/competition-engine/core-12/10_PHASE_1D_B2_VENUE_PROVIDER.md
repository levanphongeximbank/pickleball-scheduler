# CORE-12 Phase 1D-B2 — Venue Provider Integration

| | |
|--|--|
| **Phase** | **1D-B2 Option A — injected Venue provider** |
| **Date** | 2026-07-22 |
| **Status** | Option A implemented (capability-local; awaiting Owner review) |
| **Prior verdict** | `BLOCKED_AUTHORITATIVE_DESCRIPTOR_PUBLIC_CONTRACT` (**resolved**) |
| **Cleared by** | Venue & Court Phase 3B + Phase 3C on `origin/main` |
| **Authorization** | `AUTHORIZE_CORE_12_PHASE_1D_B2_OPTION_A_IMPLEMENTATION` |

---

## 0. Historical blocker evidence (preserved)

Phase 1D-B2 initially audited CORE-12 against then-current Venue APIs and selected
**OPTION B**: authoritative inventory existed (`listCourts` / Club V3), but **no**
stable Competition-facing `CanonicalCourtDescriptor` public contract was exposed.

Stop code at that time: **`BLOCKED_AUTHORITATIVE_DESCRIPTOR_PUBLIC_CONTRACT`**.

That finding remains historically valid for the pre–Phase-3B tree. It is **resolved**
for current main by:

| Upstream | Contribution |
|----------|----------------|
| Venue Phase 3B | `listCanonicalCourtDescriptors` + authority/version pins |
| Venue Phase 3C | Authoritative finite `court.priority` persistence into Club V3 |

CORE-12 must still not invent descriptors from eligibility IDs alone.

---

## 1. Selected authority option (current)

**OPTION A — EXISTING AUTHORITATIVE SOURCE** (cleared)

Venue public facade exposes sufficient canonical descriptors for injection into
CORE-12 without modifying Venue & Court in this phase.

---

## 2. Exact upstream Venue public contract

Public import path: `src/features/venue-court/index.js`

| Export | Role |
|--------|------|
| `getCompetitionCourtAvailability` | Eligibility IDs for exact civil window |
| `listCanonicalCourtDescriptors` | Canonical descriptor envelope |
| `DESCRIPTOR_AUTHORITY` | `venue-court.inventory.club_data_v3` |
| `SOURCE_CONTRACT_VERSION` | `VENUE_COURT_CANONICAL_COURT_DESCRIPTOR_V1` |

CORE-12 production modules **do not import** these symbols. The Integrator /
composition root (or tests) injects wrappers around the public facade.

CORE-12 pin copies (not Venue imports):

* `CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY`
* `CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION`

---

## 3. Dependency injection architecture

```text
Integrator / tests
  ├─ wraps getCompetitionCourtAvailability → VenueEligibilityProvider
  └─ wraps listCanonicalCourtDescriptors → CanonicalCourtDescriptorProvider
        ↓ inject
createInjectedVenueCourtAvailabilityProvider({ eligibilityProvider, descriptorProvider })
        ↓
normalizeVenueDescriptorEnvelope (pure)
        ↓
projectEligibleCourtsToAvailableInputs (pure, Phase 1D-B1)
        ↓
AvailableCourtInput[] (exact query window interval)
```

Forbidden: Venue repository / store / SQL / deep internal imports from CORE-12;
reverse Venue→CORE-12 dependency; TE / CORE-11 / CORE-14 wiring in this phase.

---

## 4. Envelope-to-descriptor normalization

`normalizeVenueDescriptorEnvelope`:

* Validates envelope object + `courts[]`.
* Pins `descriptorAuthority` / `sourceContractVersion` against expected literals.
* Validates envelope and per-court tenant/club/venue against query scope (**no ID rewrite**).
* Copies envelope authority/version onto each `CanonicalCourtDescriptor`.
* Requires explicit finite numeric `priority` (rejects missing/string/non-finite; never uses factory default `0` as Venue truth).
* Preserves Venue-certified `capabilities` (including `[]`).
* Preserves genuine nullable `sourceSnapshotId` / `sourceSnapshotVersion` (never fabricates).
* Rejects duplicate `courtId`s.
* Does not mutate the source envelope.

Courts omitted upstream for `PRIORITY_NOT_AUTHORITATIVE` remain omitted — CORE-12
does **not** recreate them from eligibility IDs.

---

## 5. Priority authority rules

* Consume only authoritative Venue `priority`.
* No string coercion; no default zero; no array-order priority.
* After valid priority is supplied, Phase 1B deterministic sort (priority then id) applies.

---

## 6. Null snapshot treatment

Venue Phase 3B always emits `sourceSnapshotId: null` and `sourceSnapshotVersion: null`.
CORE-12 preserves those nulls. Non-null genuine strings are accepted if ever supplied
upstream; CORE-12 never invents UUID/time/hash identity.

---

## 7. Capabilities limitation

Venue currently emits authoritative `capabilities: []`.

* Matches with no required capabilities may project.
* Required capabilities fail closed via existing `COURT_CAPABILITY_UNKNOWN` /
  `COURT_CAPABILITY_MISMATCH`.
* CORE-12 does not infer or enrich capabilities.

---

## 8. Fail-closed behavior

Missing providers, malformed envelopes, authority/version pin mismatch, scope
mismatch, duplicate descriptors, missing descriptor for eligible id, inactive /
locked descriptors, provider throw/rejection, invalid windows, and non-authoritative
priority all fail closed with stable `AVAILABILITY_BRIDGE_CODE` values.

Locked: only when descriptor `locked === true` (Venue maps `status === "locked"`).
Maintenance is **not** reinterpreted as locked unless Venue reports `locked: true`.

Empty eligibility remains a valid empty projection (`EMPTY_ELIGIBILITY_RESULT`),
never unrestricted courts.

Exact-window: one absolute half-open interval equal to the query window.
Overnight / cross-midnight remains unsupported.

---

## 9. Export inventory

Production (`court-assignment/index.js`):

* Ports: `isVenueEligibilityProvider`, `isCanonicalCourtDescriptorProvider`, method constants
* `normalizeVenueDescriptorEnvelope`
* `createInjectedVenueCourtAvailabilityProvider`
* Existing Phase 1D-B1 projection / invoke helpers

Test doubles: `adapters/availability/testDoubles.js` only — not production barrels.
Root `competition-core/index.js` unchanged.

Bridge pin: `CORE12_VENUE_AVAILABILITY_BRIDGE_V1`.

---

## 10. New bridge codes (Phase 1D-B2 Option A)

| Code | Use |
|------|-----|
| `MISSING_ELIGIBILITY_PROVIDER` | Injected eligibility dep missing |
| `MISSING_DESCRIPTOR_PROVIDER` | Injected descriptor dep missing |
| `MALFORMED_DESCRIPTOR_ENVELOPE` | Envelope / row shape invalid |
| `DESCRIPTOR_AUTHORITY_MISMATCH` | Authority pin mismatch |
| `DESCRIPTOR_CONTRACT_VERSION_MISMATCH` | Version pin missing/mismatch |
| `DESCRIPTOR_SCOPE_MISMATCH` | Envelope scope ≠ query |
| `PRIORITY_NOT_AUTHORITATIVE` | Missing/non-finite priority on a court row |

Existing codes reused for duplicates, projection locks, eligibility scope, provider reject, etc.

---

## 11. Explicit exclusions

No Venue source edits; no TE / CORE-11 / CORE-14 wiring; no UI; no SQL/Supabase;
no persistence/caching/retries inside the bridge; no deployment; no root barrel export;
no commit/push/PR in the implementation authorization pass.

---

## 12. Residual product constraints

1. Courts without persisted finite priority never appear in Venue descriptors → cannot be assigned via this bridge.
2. Capability taxonomy still empty upstream.
3. Venue scope rule requires aligned tenant/venue (`tenantId === club.venueId`) — Integrator must supply matching query scope; CORE-12 does not rewrite IDs.
4. Full TE cutover / orchestration end-to-end assignment remains deferred.
