# CORE-11 Phase 1C — Canonical Time & Window Model

**Status:** Implemented (review)
**Capability:** CORE-11 Schedule Engine
**Date:** 2026-07-22
**Branch:** `feature/competition-core-11-schedule-engine`

---

## Civil-time contract

Canonical civil schedule time remains:

| Field | Rule |
|-------|------|
| `date` | Real calendar `YYYY-MM-DD` |
| `minutesFromMidnight` | Integer `0..1439` |
| `timezone` | Explicit valid IANA id (required for absolute conversion; owned by `ScheduleRequest` for windows) |

Invariants:

- No machine-local timezone default.
- No implicit `Asia/Ho_Chi_Minh` default.
- No locale-dependent parsing.
- No `new Date("YYYY-MM-DD HH:mm")` domain conversion.
- Absolute UTC values are **derived**, never independent canonical inputs.
- Derived absolute fields use explicit names: `utcMs`, `utcIso`.

---

## civilTime.js delegation boundary

Conversion SSOT remains:

`src/domain/civilTime.js` (**not modified** in Phase 1C)

CORE-11 adapter:

`src/features/competition-core/schedule-engine/scheduleCivilTime.js`

| CORE-11 export | Delegates to |
|----------------|--------------|
| `convertCivilScheduleTimeToAbsolute` | `civilDateTimeToUtcMs` (+ `CIVIL_TIME_ERROR` mapping) |
| `convertSchedulingWindowToAbsoluteRange` | same, for start and exclusive end |

Local CORE-11 helpers remain validation-only (`isValidCivilDate`, minutes range, IANA recognition, half-open overlap/containment). CORE-11 does **not** compute timezone offsets, DST offsets, or civil↔UTC independently.

---

## Operating-window semantics

Normalized operating window fields:

- `windowId` (caller-supplied or deterministic `ow:{date}:{start}:{end}:{timezone}`)
- `date`, `startMinutes`, `endMinutes`, `timezone`
- `sequence` (0-based after canonical sort)
- optional non-semantic `label` / `metadata`

Rules:

1. Start inclusive, end exclusive (`[start, end)`).
2. `endMinutes > startMinutes`.
3. One civil date only — overnight rejected (`OVERNIGHT_WINDOW_NOT_SUPPORTED`).
4. Multiple windows per date allowed; gaps allowed; abutting windows (`end === next.start`) do not overlap.
5. Overlaps rejected (`OVERLAPPING_TIME_WINDOW`).
6. Duplicate equivalent intervals rejected (`DUPLICATE_OPERATING_WINDOW`).
7. Window timezone, when present, must match `ScheduleRequest.timezone` (`TIMEZONE_MISMATCH`).
8. Input order does not control output order.

Canonical sort tie-breakers (ASCII / code-unit only — never `localeCompare`):

1. `date`
2. `startMinutes`
3. `endMinutes`
4. `windowId`

---

## Session-window semantics

Normalized session window fields:

- `sessionId`, `date`, `startMinutes`, `endMinutes`, `timezone`, `sequence`
- optional non-semantic `label` / `metadata`

Rules:

1. Unique `sessionId` (`DUPLICATE_SESSION_ID`).
2. Same half-open same-day rules as operating windows.
3. Must be fully contained in **one** operating window on the same date.
4. Must not overlap other sessions.
5. Duplicate equivalent intervals rejected (`DUPLICATE_SESSION_WINDOW`).
6. Crossing / bridging multiple operating windows rejected (`SESSION_SPANS_INCOMPATIBLE_WINDOWS`).
7. Partial / full exterior / missing date rejected (`SESSION_OUTSIDE_OPERATING_WINDOW`).
8. Empty session list is allowed when operating windows remain available for later generic slot generation.
9. Session gaps are allowed.
10. Deterministic order: `date` → `startMinutes` → `endMinutes` → `sessionId`.

`validateSessionContainment` is the pure containment helper used by normalization.

---

## Inclusive / exclusive boundaries

| Boundary | Meaning |
|----------|---------|
| `startMinutes` | Inclusive |
| `endMinutes` | Exclusive |

Therefore abutting windows/sessions do not overlap, and a session ending at an operating `endMinutes` is still contained.

---

## Deterministic normalization

- No `Date.now`, `Math.random`, or locale-sensitive sort.
- No object-property iteration as semantic list order.
- No mutation of caller input.
- Identical input → identical normalized windows and diagnostics (diagnostics sorted via Phase 1B `sortScheduleDiagnostics`).

---

## Multi-day representation

Phase 1 multi-day scheduling is **only** multiple same-day windows, e.g.:

```js
[
  { date: "2026-08-01", startMinutes: 480, endMinutes: 1080, timezone: "Asia/Ho_Chi_Minh" },
  { date: "2026-08-02", startMinutes: 480, endMinutes: 1080, timezone: "Asia/Ho_Chi_Minh" },
]
```

No single window may cross midnight. Absolute conversion preserves each civil date in the supplied IANA timezone.

---

## Overnight rejection

`OVERNIGHT_POLICY.PHASE_1 = "REJECT"`.

`endMinutes < startMinutes` → `OVERNIGHT_WINDOW_NOT_SUPPORTED`.

`endMinutes === startMinutes` → `INVALID_TIME_WINDOW`.

---

## Absolute-time derived forms

```js
convertCivilScheduleTimeToAbsolute({ date, minutesFromMidnight, timezone })
// → { ok, utcMs, utcIso, diagnostics }

convertSchedulingWindowToAbsoluteRange(window, timezone?)
// → { ok, start: { utcMs, utcIso }, end: { utcMs, utcIso }, diagnostics }
```

Fail-closed on invalid civil structure and on `civilTime.js` conversion failures. Expected domain failures return diagnostics — they do not throw unstructured errors to callers.

---

## DST and ambiguity behavior

CORE-11 inherits the **actual** behavior of `civilDateTimeToUtcMs` exactly.
It does not independently detect, resolve, or reject DST fall-back ambiguity.
`AMBIGUOUS_CIVIL_TIME` is emitted only when the SSOT throws
`CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME` — documentation must not claim that
all ambiguous local times fail closed.

| Situation | civilTime.js (actual) | CORE-11 |
|-----------|----------------------|---------|
| Nonexistent spring-forward local time | throws `AMBIGUOUS_LOCAL_TIME` | `AMBIGUOUS_CIVIL_TIME`, `ok: false` |
| Fall-back ambiguous local time | current SSOT returns one absolute instant | same success (`utcMs` / `utcIso`); no independent rejection |
| Invalid IANA / date / minutes | throws mapped codes | mapped CORE-11 diagnostics |

---

## Diagnostics

### Reused Phase 1B codes

`INVALID_DATE`, `INVALID_TIMEZONE`, `INVALID_TIME_WINDOW`, `OVERLAPPING_TIME_WINDOW`, `OVERNIGHT_WINDOW_NOT_SUPPORTED`, `DUPLICATE_SESSION_ID`, `INVALID_IDENTIFIER`

### Added Phase 1C codes

| Code | Use |
|------|-----|
| `TIMEZONE_MISMATCH` | Window/session timezone ≠ request timezone |
| `DUPLICATE_OPERATING_WINDOW` | Equivalent operating intervals |
| `DUPLICATE_SESSION_WINDOW` | Equivalent session intervals |
| `SESSION_OUTSIDE_OPERATING_WINDOW` | Not fully inside one operating window / no OW on date |
| `SESSION_SPANS_INCOMPATIBLE_WINDOWS` | Crosses multiple operating windows |
| `ABSOLUTE_CONVERSION_FAILURE` | Generic conversion boundary failure |
| `AMBIGUOUS_CIVIL_TIME` | Only when SSOT throws `CIVIL_TIME_ERROR.AMBIGUOUS_LOCAL_TIME` |

Ordering remains Phase 1B deterministic sort.

---

## Request validator integration

`validateScheduleRequest` separates:

1. Raw request / policy / match validation
2. Canonical window normalization (`normalizeOperatingWindows`, `normalizeSessionWindows`)
3. Absolute-time derivation (**not** auto-run inside the validator)

Material errors are never silently corrected. Allowed normalizations: identifier whitespace trim, stable ordering, optional label trim, deterministic `windowId` / `sequence` assignment.

---

## Implemented files

| Path | Action | Responsibility |
|------|--------|----------------|
| `scheduleCivilTime.js` | create | civilTime.js adapter |
| `normalizeOperatingWindows.js` | create | operating-window normalization |
| `normalizeSessionWindows.js` | create | session normalization + containment |
| `scheduleDiagnostics.js` | modify | Phase 1C codes |
| `scheduleTypes.js` | modify | containment / derive id / typedefs |
| `scheduleContracts.js` | modify | optional window timezone/id/label/sequence |
| `validateScheduleRequest.js` | modify | integrate normalization |
| `index.js` | modify | export Phase 1C surface |
| `tests/...phase1c-time-windows.test.js` | create | focused Phase 1C tests |
| `docs/.../03_PHASE_1C_TIME_WINDOW_MODEL.md` | create | this document |

Unauthorized trees (`civilTime.js`, CC-09 `scheduling/`, CORE-09, UI, persistence, Supabase) were **not** modified.

---

## Test coverage

Focused file:

`tests/competition-core-schedule-engine-core11-phase1c-time-windows.test.js`

Covers single/multi-day windows, order independence, half-open boundaries, gaps/overlaps/duplicates, invalid civil/timezone/minutes/overnight, session containment cases, empty sessions, civil→UTC ms/ISO for `Asia/Ho_Chi_Minh` and `America/New_York`, spring-forward gap fail-closed via SSOT, fall-back ambiguous times inheriting the SSOT instant, multi-day absolute ranges, immutability, no host-local default, static import/export hygiene, Phase 1B-compatible request integration.

Also keep Phase 1B green:

```powershell
node --test tests/competition-core-schedule-engine-core11-phase1b-contracts.test.js
node --test tests/competition-core-schedule-engine-core11-phase1c-time-windows.test.js
```

---

## Deferred work

- Dependency graph traversal / cycle detection / topological order (Phase 1D+)
- Earliest-start dependency calculation
- Slot generation / match placement / baseline scheduler
- Participant/team overlap, rest enforcement, capacity enforcement
- CORE-09 adapter, CORE-10 optimizer runtime, CORE-12 court assignment
- Persistence, UI integration, runtime cutover

---

## Next proposed phase

**Phase 1D (proposed):** dependency-graph construction, cycle detection, and topological ordering over `ScheduleMatchInput.dependencies` — still without slot generation, physical court/referee assignment, or UI cutover.
