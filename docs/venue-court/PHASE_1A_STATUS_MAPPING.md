# Phase 1A — Court Status Mapping

**Status:** Mapping and precedence only — **no unified enum in Phase 1**  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`

---

## Principle

```text
Không tạo một enum tổng hợp trong Phase 1.
Chỉ tạo mapping và rule precedence.
```

Three vocabularies remain separate. Adapters translate; they do not merge into one SSOT enum.

---

## Vocabulary A — Court master status

**Owner:** Venue & Court  
**Source:** `club_data_v3.data.courts[].status` (+ `active`)  
**Model:** `src/models/court.js` → `COURT_STATUSES`

| Value | Meaning |
| ----- | ------- |
| `active` | Court may receive new bookings/assignments if otherwise available |
| `locked` | Master lock — no new assignments |
| `maintenance` | Master maintenance — no new assignments |

`active: false` is treated as inactive (equivalent to not bookable), even if status string is stale.

---

## Vocabulary B — Court Engine runtime

**Owner:** Court Engine  
**Source:** session/runtime store (`COURT_RUNTIME_STATUS`)  
**File:** `src/features/court-engine/constants/statuses.js`

| Value | Meaning |
| ----- | ------- |
| `empty` | No active assignment |
| `assigned` | Assigned but not playing |
| `playing` | Match/session in play |
| `paused` | Temporarily paused |
| `overrun` | Exceeded planned time |
| `completed` | Runtime slot finished (not master) |
| `locked` | Runtime lock within engine |
| `maintenance` | Runtime maintenance flag within engine |

---

## Vocabulary C — Tournament runtime

**Owner:** Competition / Director tournament engines  
**Source:** `COURT_STATUS` in `src/models/tournament/constants.js`  
**Built by:** `src/tournament/engines/courtEngine.js` → `buildCourtRuntimeState`

| Value | Meaning |
| ----- | ------- |
| `AVAILABLE` / `available` | No active match; not locked |
| `PLAYING` / `playing` | Active match on court |
| `LOCKED` / `locked` | Tournament lock or lockedCourtIds |

---

## Mapping matrix (informational)

| Master | Court Engine runtime | Tournament runtime | New assignment allowed? |
| ------ | -------------------- | ------------------ | ----------------------- |
| `active` | `empty` | `available` | Yes (if bookings/hours OK) |
| `active` | `assigned` / `playing` / `paused` / `overrun` | `playing` | No for **other** sessions; owning engine manages its session |
| `active` | `locked` / `maintenance` | `locked` | No |
| `locked` | any | any | **No** new assignment |
| `maintenance` | any | any | **No** new assignment |
| inactive (`active: false`) | any | any | **No** |

Notes:

- Court Engine `completed` does not change master status.
- Tournament `playing` does not write master `status`.
- Runtime `locked` / `maintenance` are **engine-local** until cleared by that engine; they must not be persisted as Court master without an explicit Venue & Court write path (bookingService `setCourtOperationalStatus` is the CM path — Court Engine must not invent a parallel master write).

---

## Hard rules

```text
Master locked hoặc maintenance
→ tất cả engine không được tạo assignment mới.
```

```text
Runtime playing/paused/overrun
→ thuộc engine sở hữu session.
```

```text
Không ghi ngược runtime status
vào Court master status.
```

```text
Không tạo một enum tổng hợp trong Phase 1.
Chỉ tạo mapping và rule precedence.
```

---

## Precedence order (availability / assignment gate)

Default order for answering “may we use this court now/in range?”:

```text
1. Court not found
2. Court master locked
3. Court master maintenance
4. Maintenance booking
5. Existing booking
6. Runtime occupancy
7. Venue hours
8. Available
```

### Why this order

| Step | Rationale |
| ---- | --------- |
| 1 Not found | Fail closed; no court to evaluate |
| 2–3 Master locked/maintenance | Hard inventory policy; overrides any engine desire |
| 4 Maintenance booking | Time-scoped block even if master still `active` |
| 5 Existing booking | Calendar SSOT occupancy (includes tournament bookings) |
| 6 Runtime occupancy | Session-layer busy; optional for booking-only contexts; required for Court Engine assign |
| 7 Venue hours | Ops window; checked after occupancy so conflict messages prefer concrete bookings |
| 8 Available | Only if all prior gates pass |

### Alternative considered (hours before bookings)

Checking hours before bookings would fail faster for out-of-window requests, but existing Court Management UX and conflict messages emphasize booking conflicts first. Phase 1 keeps bookings before hours for message clarity; both still fail closed.

**Inactive court** (`active: false`) is treated at the same priority band as not bookable — immediately after not found / with locked (implementation may emit `COURT_INACTIVE`).

---

## Adapter responsibilities (design)

| Adapter | Input | Output | Side effects |
| ------- | ----- | ------ | ------------ |
| `courtEngineStatusAdapter` | Master court + CE runtime | `{ master, runtime, canAssignNew }` | None |
| `competitionCourtAdapter` | Master court + tournament runtime + availability | `{ canAssign, reasons }` | None |
| Availability contract | Master + bookings + hours (+ optional runtime) | `{ available, conflicts }` | None |

Adapters **read**; they do not mutate master status.

---

## Forbidden writes

| From | To | Forbidden |
| ---- | -- | --------- |
| Court Engine runtime | `courts[].status` | Yes |
| Tournament `COURT_STATUS` | `courts[].status` | Yes |
| Availability result | Any write | Yes (read-only) |
| AI suggestion | Master status | Yes |

Allowed master status changes remain via Court Management / `bookingService.setCourtOperationalStatus` (Venue & Court owned).

---

## Related documents

- `PHASE_1A_GLOSSARY.md`
- `PHASE_1A_AVAILABILITY_CONTRACT.md`
- `PHASE_1A_FACADE_DESIGN.md`
