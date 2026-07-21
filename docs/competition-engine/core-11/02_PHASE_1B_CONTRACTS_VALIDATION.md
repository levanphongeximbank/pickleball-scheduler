# CORE-11 Phase 1B — Contracts & Validation

**Status:** Implemented (review)
**Capability:** CORE-11 Schedule Engine
**Date:** 2026-07-22
**Branch:** `feature/competition-core-11-schedule-engine`

---

## Implemented files

| Path | Responsibility |
|------|----------------|
| `src/features/competition-core/schedule-engine/scheduleConstants.js` | Engine identity, severity, overnight policy, forbidden assignment fields |
| `src/features/competition-core/schedule-engine/scheduleTypes.js` | Shared helpers + JSDoc domain contracts |
| `src/features/competition-core/schedule-engine/scheduleDiagnostics.js` | Diagnostic codes + factory + deterministic sort |
| `src/features/competition-core/schedule-engine/scheduleContracts.js` | Factories, fingerprint/equality, forbidden-field scan, port shape matchers |
| `src/features/competition-core/schedule-engine/validateScheduleRequest.js` | Pure request validator |
| `src/features/competition-core/schedule-engine/validateSchedulePlan.js` | Pure plan/result validator + `ScheduleResultValidator` |
| `src/features/competition-core/schedule-engine/index.js` | Public exports |
| `tests/competition-core-schedule-engine-core11-phase1b-contracts.test.js` | Focused Phase 1B tests |
| `docs/competition-engine/core-11/01_PHASE_1A_ARCHITECTURE_DECISIONS.md` | Approved Phase 1A decisions |
| `docs/competition-engine/core-11/02_PHASE_1B_CONTRACTS_VALIDATION.md` | This report |

Unauthorized trees (CC-09 `scheduling/`, CORE-09 `match-generation/`, UI, persistence, `civilTime.js`) were **not** modified.

---

## Canonical contracts

Factories return fresh plain records (no `Date.now()`, no `Math.random()`, no machine timezone injection). Callers must treat outputs as immutable for equality/fingerprint use.

| Contract | Key invariants |
|----------|----------------|
| `CivilScheduleTime` | `date` YYYY-MM-DD; `minutesFromMidnight` ∈ 0..1439 |
| `SchedulingWindow` / `SessionWindow` | same-day; `endMinutes > startMinutes` (end exclusive); session requires `sessionId` |
| `ScheduleParticipantReference` | non-empty `participantId` |
| `ScheduleDependency` | non-empty `sourceMatchId`; duplicate `(sourceMatchId, type)` rejected |
| `ScheduleMatchInput` | unique `matchId`; optional duration/priority/deps/participants; `isBye` |
| `MatchDurationPolicy` | positive `defaultDurationMinutes`; non-negative `bufferMinutes` |
| `RestPolicy` | non-negative min rest fields; no `strict` switch |
| `CapacityPolicy` | required positive `maxConcurrentMatches` |
| `SchedulePolicy` | duration + rest + capacity |
| `ScheduleRequest` | `competitionId`, IANA `timezone`, `matches[]`, `policy`, windows |
| `ScheduledMatch` | civil start/end; end after start; same civil date; non-neg `sequence`; optional `abstractSlotIndex` |
| `UnscheduledMatch` | `matchId` (+ optional reason) |
| `ScheduleDiagnostic` | known `code`, severity, path, message, relatedMatchIds, details |
| `ScheduleReplayMetadata` | `engineId`, `engineVersion` (+ optional fingerprints) |
| `SchedulePlan` | scheduled / unscheduled / diagnostics arrays; optional non-semantic `producedAt` |
| `ScheduleOptimizerPort` | optional; `optimizeSchedule` shape only; unused in Phase 1B |
| `ScheduleCapacityPort` | optional future CORE-12 shape; unused in Phase 1B |
| `ScheduleResultValidator` | `validateSchedulePlan` |

---

## Validators

### `validateScheduleRequest`

Implemented checks include: object shape; identifiers; IANA timezone; match uniqueness; participant/dependency shapes; unknown dependency IDs when match set complete; duration/rest/capacity policy; same-day windows; overnight reject; window overlaps within operating/session collections; duplicate session IDs; forbidden court/referee fields on decision surfaces; fail-closed malformed input; informational `BYE_NO_SCHEDULE_REQUIRED` for bye matches.

**Deferred (Phase 1D / later):**

- cyclic dependency detection (`CYCLIC_MATCH_DEPENDENCY`)
- dependency order / timing (`DEPENDENCY_ORDER_VIOLATION`)
- participant/team overlap, rest interval math, capacity usage at placement time
- match-outside-window / unschedulable / incomplete schedule outcomes from an executor

### `validateSchedulePlan`

Implemented checks include: object/array shapes; unique scheduled & unscheduled IDs; mutual exclusion; civil intervals; sessionId/sequence/abstractSlotIndex shapes; forbidden assignment fields; replay + diagnostic structure; deterministic normalization of output arrays; `producedAt` shape-only (excluded from fingerprint).

**Deferred:** overlap/rest/dependency/capacity placement invariants (executor phases).

---

## Diagnostic model

Stable codes live in `SCHEDULE_DIAGNOSTIC_CODE` (including deferred-check codes declared without detectors).

Deterministic ordering: `code` → `path` → `message` → `relatedMatchIds` joined → `details` JSON, via ASCII/code-unit compare (**never** `localeCompare`).

Severities: `ERROR` | `WARNING` | `INFO`.

---

## Test coverage

Focused file:

`tests/competition-core-schedule-engine-core11-phase1b-contracts.test.js`

Covers the Owner Phase 1B matrix (minimal request/plan, timezone/date/window/rest/duration/capacity failures, court/referee rejection, duplicates, determinism, immutability, `producedAt` non-semantic equality, bye code, optimizer unused, no persistence/UI/CC-09 imports).

Run:

```bash
node --test tests/competition-core-schedule-engine-core11-phase1b-contracts.test.js
```

Do not require full-repo suite for Phase 1B.

---

## Time SSOT (Phase 1B pre-commit)

| Concern | Owner |
|---------|--------|
| Contract validation of civil date / minutes / same-day windows / overlap / IANA recognition | CORE-11 local helpers in `scheduleTypes.js` (validation only) |
| Civil↔UTC conversion, offset/DST ambiguity, absolute timestamp generation | **`src/domain/civilTime.js`** (unchanged; future consumer of later phases) |

Phase 1B does **not** duplicate conversion logic. Later phases that need absolute instants must call the canonical `civilTime.js` boundary rather than extending local helpers into converters.

---

## Known limitations

- No scheduler, graph, or slot generator.
- Civil/IANA helpers are validation-only; `civilTime.js` is not imported (avoids data-layer coupling) and remains the conversion SSOT.
- Rest/capacity codes for runtime enforcement are declared but not computed.
- CORE-09 adapter and CORE-10 optimizer are not present.
- Official CI unit-test manifest is Integrator-owned; Phase 1B tests run via direct `node --test`.

---

## Next proposed phase

**Phase 1C / 1D (proposed):** dependency graph construction + cycle detection, then baseline topological / slot-aware scheduling under civil windows with hard rest and abstract capacity — still without physical court/referee assignment or UI cutover.
