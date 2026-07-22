# CORE-12 Phase 1D — Availability Wiring

| | |
|--|--|
| **Phase** | **1D-B1 — contract foundation only** (certified 1D-B1-C) |
| **Date** | 2026-07-22 |
| **HEAD base** | `a3422a37…` (= `origin/main` at implementation sync) |
| **Status** | Foundation implemented + certification remediations; **full CAA wiring not complete** |

## 1. Scope statement

Phase 1D-B1 creates capability-local contracts, pure projection, deterministic fingerprints, validation, async provider invocation helper, tests, and docs.

It does **not** complete Phase 1D availability wiring. **No production deployment is authorized** by this phase.

## 2. Full CAA wiring remains blocked

The Venue & Court Competition Availability Adapter returns **eligibility IDs**, not authoritative canonical court descriptors. Concrete Venue CAA provider wiring is **deferred** until a canonical descriptor source is authorized. **Canonical descriptor authority for live wiring remains unresolved.**

## 3. No concrete Venue provider

There is **no** `createCompetitionCourtAvailabilityProvider` (or similar) in this phase. No `venue-court` runtime import exists under the Phase 1D-B1 foundation files.

## 4. No production orchestration

There is **no** `assignCourtsFromCanonicalAvailability` production orchestration that loads live availability and assigns courts end-to-end.

## 5. Eligibility IDs are not court descriptors / inventory

`EligibilitySnapshot.eligibleCourtIds` are eligibility evidence only. They are **not** inventory descriptors. Projection requires a matching `CanonicalCourtDescriptor` per eligible ID.

## 5b. Descriptor authority (critical)

`createCanonicalCourtDescriptor` performs **structural validation** only.

| Layer | Meaning |
|-------|---------|
| Structural validation | Fields pass factory checks |
| Declared authority | Required non-empty `descriptorAuthority` / `sourceContractVersion` supplied by caller |
| Independently verified authority | Proven inventory provenance from an Owner-approved source |

**Structural validation does not prove authoritative inventory provenance.** Caller-supplied descriptors that satisfy shape are **not** automatically authoritative.

## 6. Exact-window projection rules

When eligibility is certified for one exact query window, projection may attach **exactly one** absolute half-open interval:

`[windowStart, windowEnd)`

Same-day whole-window projection only. **Overnight and cross-midnight windows are unsupported** and fail closed.

Prohibited: all-day intervals, empty unrestricted intervals from CAA eligibility, multi-interval invention, silent merges, overnight projection, tournament-window substitution.

## 6b. Locked descriptor policy (Phase 1D-B1)

`CanonicalCourtDescriptor.locked === true` → projection **always fail-closes** with `COURT_DESCRIPTOR_LOCKED`.

There is **no** manual-lock override path inside the pure projector. Locked courts are not generally assignable. Future orchestration may resolve locks separately; Phase 1D-B1 does not.

`active === false` → `COURT_NOT_ENABLED` (distinct code).

## 7. Async provider boundary

`AvailabilitySnapshotProvider.resolveEligibilitySnapshot(query)` may return a value or Promise.
`invokeAvailabilitySnapshotProvider` always `await`s via `Promise.resolve` so sync implementations remain compatible without hiding Promises behind a sync port.

Timeout policy is defined as deferred (not implemented in B1).

## 8. Source versus derived snapshot semantics

| Field | Rule |
|-------|------|
| `sourceSnapshotId` / `sourceSnapshotVersion` | Nullable; **never fabricated** |
| `derivedEligibilityFingerprint` | Required; labeled **derived** |
| `queryFingerprint` | Required; deterministic |
| `derivedAvailabilityFingerprint` | Required on successful projection; **derived**; metadata excluded from material |

## 9. Error taxonomy

Stable codes: `AVAILABILITY_BRIDGE_CODE` in `contracts/availabilityBridgeCodes.js`.

Empty successful eligibility → valid empty projection + `EMPTY_ELIGIBILITY_RESULT` finding (not unrestricted).

## 10. Export surface

Production (`court-assignment/index.js`): contracts, codes, fingerprints, `projectEligibleCourtsToAvailableInputs`, `invokeAvailabilitySnapshotProvider`, provider method constants.

Test doubles: `adapters/availability/testDoubles.js` only — **not** re-exported from production barrel or `adapters/availability/index.js`.

No root `competition-core/index.js` changes.

## 11. Tests

`tests/competition-core-court-assignment-core12-phase1d.test.js`

## 12. Known limitations

- No live CAA binding
- No descriptor discovery/loading
- No multi-window orchestration grouping
- No timeout implementation
- CORE-11 / CORE-14 / TE untouched

## 13. Deferred work / remaining blockers

- Injected Venue CAA provider (Owner + Venue authorization)
- Independently verified canonical descriptor authority integration
- Production orchestration
- TE cutover (**deferred**)
- CORE-11 scheduled-match production integration (**deferred**)
- CORE-14 conflict integration (**deferred**)

## 14. Explicit non-goals

UI, SQL, Supabase, persistence, routes, deployment, schedule generation, CORE-14, root barrel export, inventing court metadata from IDs, production cutover.

## 15. Next ownership decision

Owner must choose how live descriptors are sourced (Venue extension vs Integrator-injected verified descriptors) before Phase 1D-B2 concrete CAA wiring.
