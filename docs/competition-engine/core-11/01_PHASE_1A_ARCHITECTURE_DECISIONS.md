# CORE-11 Phase 1A — Architecture Decisions (Approved)

**Status:** Owner-approved
**Capability:** CORE-11 Schedule Engine
**Date recorded:** 2026-07-22
**Branch context:** `feature/competition-core-11-schedule-engine`

This document freezes Phase 1A audit findings as Owner decisions for Phase 1B+ implementation. It does not restate the full audit transcript.

---

## Canonical module decision

| Item | Decision |
|------|----------|
| Canonical path | `src/features/competition-core/schedule-engine/` |
| Engine ID | `CORE11_SCHEDULE_ENGINE` |
| Engine version | `core11-v1` |
| Schema version | `core11.schedule-engine.v1` |

New schedule-domain work for CORE-11 lives only under the canonical path above.

---

## CC-09 legacy boundary

| Path | Meaning |
|------|---------|
| `src/features/competition-core/scheduling/` | Historical **CC-09** shadow scheduling |

CC-09 must not be renamed, replaced, modified, or re-exported by CORE-11 Phase 1B. Downstream cutover adapters (later phases) own any migration mapping.

---

## CORE-09 input boundary

CORE-09 Match Generator (`src/features/competition-core/match-generation/`) remains unchanged.

CORE-11 later consumes CORE-09 outputs through a **downstream-owned adapter** (not implemented in Phase 1B). Canonical ScheduleRequest match inputs support concepts equivalent to:

- `matchId`, competition context, `divisionId`, `stageId`, `roundNumber`, `sequence`
- participants, dependency references, `isBye`
- optional `estimatedDurationMinutes`, `priority`, opaque `metadata`

CORE-11 must not copy CORE-09 implementation into the schedule-engine tree.

---

## Optional CORE-10 port

CORE-10 Global Optimizer is absent and must not block CORE-11.

Phase 1B defines only a JSDoc / shape contract:

`ScheduleOptimizerPort.optimizeSchedule(request, context)`

The port is **optional** and **must not be called** in Phase 1B. Future optimizer outputs must pass CORE-11 plan/result validation.

---

## CORE-12 physical-court boundary

Canonical CORE-11 decision records must **not** contain final physical assignment fields:

- `courtId`, `courtName`, `courtNumber`, `assignedCourt`
- `refereeId`, `assignedReferee`

CORE-11 may represent only abstract capacity / placement:

- `maxConcurrentMatches`
- `abstractSlotIndex`
- `requiredCapacity`
- `sessionId`
- planned civil time

Physical court inventory and referee assignment belong to later CORE-12 / assignment capabilities.

---

## Canonical time decision

Scheduling decisions use:

- civil date `YYYY-MM-DD`
- `minutesFromMidnight` integer `0..1439`
- explicit IANA timezone
- end boundary **exclusive**
- absolute UTC ISO may be derived later via `src/domain/civilTime.js` (do not modify that module in Phase 1B for CORE-11 contracts)

Forbidden for domain decisions:

- host-local `Date` parsing
- locale-dependent date parsing

---

## Overnight rejection

Phase 1 overnight policy: **REJECT**.

Every scheduling window must remain inside one civil date. Multi-day competitions use multiple same-day windows.

---

## Hard minimum rest

Minimum rest is a hard constraint in canonical Phase 1 policy shape:

- `minParticipantRestMinutes` (required; non-negative integer; `0` disables)
- optional `minTeamRestMinutes` (non-negative integer; `0` disables)
- no generic `strict: false` switch

Additional rest balancing beyond the minimum is a future CORE-10 soft objective (not Phase 1B).

---

## Required abstract capacity

`ScheduleRequest.policy.capacity.maxConcurrentMatches` is required:

- positive integer
- no silent default
- no physical court identity list
- no direct venue/court repository dependency

Future adapters may derive the number from legacy `courtCount` or a CORE-12 capacity port.

---

## Bye handling

A bye match:

- does not consume a time slot
- does not consume concurrency capacity
- does not appear as scheduled or unscheduled
- remains traceable via informational diagnostic `BYE_NO_SCHEDULE_REQUIRED`

---

## Duration ownership

Duration resolution ownership belongs to CORE-11.

Canonical contracts may include:

- optional `match.estimatedDurationMinutes`
- required `policy.duration.defaultDurationMinutes`
- optional duration-by-round / duration-by-stage maps
- non-negative `bufferMinutes`

Every resolved actual duration must be a positive integer (resolution executed in later phases; Phase 1B validates shape/direct values only).

Do not modify CORE-09 to add duration fields.

---

## Phase 1B scope reminder

Phase 1B implements contracts, diagnostics, and pure validators only. It does **not** implement dependency-graph execution, topological scheduling, slot generation, baseline algorithm, optimization, physical assignment, persistence, UI wiring, or production cutover.
