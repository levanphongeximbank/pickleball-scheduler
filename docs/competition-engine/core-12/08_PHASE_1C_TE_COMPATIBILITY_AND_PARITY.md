# CORE-12 Phase 1C — Tournament Engine Compatibility and Shadow Parity

**Phase:** 1C / 1C-R (certified)

**Module:** `src/features/competition-core/court-assignment/`

**Branch:** `feature/competition-core-12-phase-1c-te-parity`

**Certification HEAD / origin/main:** `500cfc4474477d8da31fae63dcb52d5992d27b35` (FF CORE-13 referee; no CORE-12 path collision)

**Production cutover:** **not planned**. TE `assignCourts` remains the production path.

Phase 1A / 1B ownership documents remain authoritative.

---

## 1. Legacy source anchoring (Model B)

| Field | Value |
|-------|-------|
| Model | **FROZEN_BEHAVIORAL_REFERENCE** (Model B) |
| Live TE import in CORE-12 production / parity modules | **None** |
| Audited source path | `src/features/tournament-engine/engines/courtAssignmentEngine.js` |
| Audited commit | `500cfc4474477d8da31fae63dcb52d5992d27b35` |
| Source SHA-256 | `A5FDDB6E4E98F4092A5F88E460F1011883152115C3213869DE3FAAC3B6D34AFE` |
| Reference harness | `parity/legacyReferenceAssignCourts.js` |
| Drift detector | `parity/legacySourceAnchor.js` → `detectLegacyTeCourtAssignmentDrift` |

The harness mirrors TE **LEGACY** availability-mode algorithm (including unsafe behaviors). Certification fails if the TE source hash or required behavioral markers change.

Locale `localeCompare(..., "vi")` is isolated to the legacy reference and does **not** control CORE-12 ordering.

---

## 2. Adapter mapping contract

**Module:** `adapters/te-compat/adaptTournamentEngineCourtAssignmentInput.js`

**Dedicated export surface:** `compatibility/index.js` (not `adapters/index.js` test doubles; not production `court-assignment/index.js` assign API)

**Contract:** `CORE12_TE_ADAPTER_CONTRACT_V1`

### Maps

Explicit scope, matches + absolute intervals, adapter-shaped `courtAvailabilitySnapshots`, `manualCourtLock`+`courtId`, capabilities, priorities.

### Fail-closed

Missing match id, scope ids, timezone, scheduled interval, court id, availability snapshot array, ambiguous lock, cross-scope ids, timezone-less / invalid calendar instants → `TE_ADAPTER_MAPPING_CODE_*`.

**Phase 1C availability rule:** each mapped court requires **at least one** explicit, valid, normalized absolute interval in `availabilityIntervals`.

Rejected as unrepresentable (`EMPTY_COURT_AVAILABILITY`, `INVALID_AVAILABILITY_INTERVAL`, related codes):

* missing / null `availabilityIntervals`
* non-array `availabilityIntervals`
* `availabilityIntervals: []`
* only-invalid intervals, or mixed valid+invalid (deterministic policy: **any** invalid interval rejects the court; valid siblings are not kept)

Empty `[]` is **never** interpreted as unrestricted, always-available, full-day, tournament-wide, match-window, or enabled-by-default. The adapter never synthesizes intervals from match times, tournament/schedule windows, operating hours, or wall-clock.

> Phase 1B deterministic core may still treat empty intervals + `AVAILABLE` as unrestricted **inside** an already-certified `CourtAssignmentRequest`. That internal Phase 1B behavior is **not** exposed through this TE compatibility boundary — the adapter will not emit such courts. Live Competition Availability Adapter wiring remains deferred to Phase 1D.

### Must not

Generate matches/times; infer scope/court; first-venue/court fallback; invent all-day availability; treat inventory existence as availability; use tournament window as availability; calculate hours/maintenance/bookings; merge intervals; call Venue/TE/UI/Supabase; mutate legacy input.

---

## 3. Shadow-parity runner

`parity/runShadowParity.js` runs isolated legacy reference + adapter + `assignCourtsDeterministic`, then `compareLegacyAndCore12CourtAssignment`.

Classification precedence: **`CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1`**

| Rank | Final classification |
|------|----------------------|
| 0 | FIXTURE_INVALID |
| 1 | UNREPRESENTABLE_LEGACY_INPUT |
| 2 | LEGACY_UNSAFE |
| 3 | CORE12_REGRESSION |
| 4 | INTENTIONAL_DIVERGENCE |
| 5 | SEMANTIC_PARITY |
| 6 | EXACT_PARITY |

Each fixture emits exactly one `finalClassification` plus ordered findings. Legacy `ok` is metadata only (`LEGACY_SUCCESS_CLASS`); never mapped to CORE-12 `SUCCESS`.

---

## 4. Fixture manifest

Synthetic `F01`…`F30` in `fixtures/te-compat/`. Manifest builder: `buildTeParityFixtureManifest` / `certifyTeParityFixtureManifest`.

**Executed fixture count:** 30 (parameterized via catalog loop). Test declaration count may be lower.

---

## 5. Production export surface

`court-assignment/index.js` production exports: constants/versions (incl. 1C-R version pins), enums, contracts, deterministic helpers, validate/assign, production port factory.

**Not exported from production index:** fixture catalog, parity runner, legacy reference, drift detector, TE adapter, test doubles.

TE adapter is a legitimate **compatibility mapping API** on `compatibility/index.js` / `adapters/te-compat/` — mapping only, not assignment. No root `competition-core/index.js` export.

---

## 6. Intentional divergences (12)

Catalog `CORE12_DIVERGENCE_CATALOG_V1` in `parity/intentionalDivergences.js`. Each entry includes fixtureIds, approvedInvariant, migrationImpact, productionCompatibilityRemaining.

---

## 7. Production isolation

TE runtime unmodified; no TE→CORE-12 imports; no live CAA; no CORE-14; no SQL/Supabase; no UI routes.

---

## 8. Known limitations

1. Shadow uses LEGACY-mode reference, not live REQUIRED Venue filtering (Phase 1D).
2. Capability hard-match is CORE-12-only.
3. Terminal matches without representable intervals are omitted.
4. Model B requires updating the source SHA when TE assignCourts intentionally changes.

---

## 9. Recommended next action

Owner-controlled commit of Phase 1C/1C-R. Phase 1D remains separately authorized (live `CourtAvailabilityPort` wiring; still no TE cutover unless authorized).
