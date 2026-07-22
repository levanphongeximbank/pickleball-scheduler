# CORE-14 — Availability Port

**Contract family:** `core14-availability-port-v1`
**Phase:** 1B / 1B-S — Contract Freeze
**Status:** Frozen
**Date:** 2026-07-22

---

## 1. Neutrality rule

CORE-14 must **not** import Venue & Court internal implementation.

Venue & Court (or any provider) is consumed only through this neutral port / adapter boundary.

---

## 2. Modes

### AUTHORITATIVE

| Situation | Behavior |
|-----------|----------|
| Resource unavailable | Emit HARD finding (`RESOURCE_UNAVAILABLE` / `VENUE_UNAVAILABLE`) |
| Provider failure / unknown | Fail closed: `evaluationStatus=DATA_UNAVAILABLE`, `planStatus=NOT_EVALUATED`, diagnostic `AVAILABILITY_DATA_UNAVAILABLE`, `availabilityCertification=NOT_EVALUATED` |
| Plan certification | Must **not** certify plan conflict-free w.r.t. availability |

### ADVISORY

| Situation | Behavior |
|-----------|----------|
| Provider failure / unknown / unavailable data | Do **not** treat resource as available; emit `AVAILABILITY_DATA_UNAVAILABLE` (or applicable diagnostic); set `availabilityCertification=PARTIAL` |
| Unknown availability | Must **not** be treated as available |
| Evaluation completion | May set `evaluationStatus=COMPLETED` when occupancy detection otherwise completes |
| Plan status without HARD findings | `planStatus=VALID_WITH_WARNINGS` — **never** `VALID` solely because no other conflict was found |
| Plan certification | Partial disclosure required |

---

## 3. AvailabilityCertification

Frozen on `DetectionResult.metadata`:

| Value | Meaning |
|-------|---------|
| `FULL` | All required queries answered definitively |
| `PARTIAL` | Incomplete/unknown/error under advisory (or soft disclosure) |
| `NOT_EVALUATED` | Authoritative failure, rejected input, or availability not in scope |

`availabilityFullyCertified` is the boolean projection of `availabilityCertification === FULL`.

---

## 4. Port operations (neutral)

```text
AvailabilityPort {
  getResourceAvailability(query: AvailabilityQuery): AvailabilityAnswer
  getBlackoutWindows(query: BlackoutQuery): BlackoutAnswer
  getCapacity(query: CapacityQuery): CapacityAnswer
  getDataStatus(query: DataStatusQuery): DataStatusAnswer
  getProviderMetadata(): ProviderMetadata
}
```

Exact TypeScript/JS signatures are Phase 1C concerns; the **semantic operations** above are frozen.

---

## 5. Query / answer contracts (minimum)

### AvailabilityQuery

```text
{
  resourceKey: CanonicalResourceKey
  startMs: number    // Number.isSafeInteger
  endMs: number      // Number.isSafeInteger; startMs < endMs
  requestId: string
}
```

### AvailabilityAnswer

```text
{
  status: AVAILABLE | UNAVAILABLE | UNKNOWN | ERROR
  unavailableWindows: Array<{ startMs: number, endMs: number, reasonCode: string | null }>
  providerVersion: string
}
```

Window bounds must be safe integers when present.

### BlackoutAnswer

```text
{
  status: OK | UNKNOWN | ERROR
  windows: Array<{ startMs: number, endMs: number, reasonCode: string | null }>
  providerVersion: string
}
```

### CapacityAnswer

```text
{
  status: OK | UNKNOWN | ERROR
  capacity: number | null          // finite > 0 when OK and known; no hidden venue default
  providerVersion: string
}
```

### DataStatusAnswer

```text
{
  completeness: COMPLETE | PARTIAL | UNAVAILABLE
  checkedAtMs: number | null       // provider-supplied safe integer; not Date.now() inside CORE-14
  notes: string | null
}
```

### ProviderMetadata

```text
{
  providerId: string
  providerVersion: string
  contractVersion: string
}
```

---

## 6. Mapping into CORE-14

| Answer | AUTHORITATIVE | ADVISORY |
|--------|---------------|----------|
| `UNAVAILABLE` | HARD finding (`RESOURCE_UNAVAILABLE` / `VENUE_UNAVAILABLE`) | SOFT finding (same codes); definitive unavailable still counts toward `FULL` certification when all queries answered |
| `UNKNOWN` | Fail closed (`DATA_UNAVAILABLE` / `NOT_EVALUATED`) | Diagnostic; not available; `PARTIAL`; no `VALID` without other conflicts |
| `ERROR` | Fail closed | Diagnostic; `PARTIAL`; no `VALID` without other conflicts |
| `AVAILABLE` + COMPLETE data | May contribute to `FULL` | Soft path; still requires complete required query set for `FULL` |

Canonical unavailable severity is mode-selected (Phase 1D):

- `AUTHORITATIVE` → HARD
- `ADVISORY` → SOFT

This is **not** a caller downgrade. See [07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md) and [17_PHASE_1D_DORMANT_CONFLICT_DETECTORS.md](./17_PHASE_1D_DORMANT_CONFLICT_DETECTORS.md).

Venue capacity uses `getCapacity` on `VENUE` keys; absence of hidden default remains mandatory ([07_SEVERITY_POLICY.md](./07_SEVERITY_POLICY.md)).

---

## 7. Anti-patterns

- Importing Venue & Court repositories/services directly into CORE-14
- Assuming missing capacity means unlimited
- Treating advisory unknown as free
- Returning `planStatus=VALID` under advisory partial certification
- Caching provider answers without including provider version in fingerprints when answers affect findings
