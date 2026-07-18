# Phase 1A — Module Ownership Boundary

**Status:** Official ownership boundary for Venue & Court Phase 1  
**Scope:** Design only — no code changes  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`

---

## Purpose

Define who owns what so Phase 1B+ can introduce a Venue & Court facade without rewriting Court Management, Court Engine, or Competition scheduling.

---

## Venue & Court owns

| Concern | Current substrate (Phase 1) |
| ------- | --------------------------- |
| Venue metadata liên quan vận hành sân | `venues` / `venueService` / `data/venue` |
| Court Cluster | `court_clusters` / `features/court-cluster` / `data/courtCluster` |
| Court master data | `club_data_v3.data.courts[]` via `clubStorage` / `courtService` |
| Court inventory | Same Club V3 courts array — **no second inventory** |
| Booking | `club_data_v3.data.bookings[]` via `bookingService` |
| Venue operating hours (target SSOT) | Prefer `courtManagement.openHour/closeHour` for ops; consolidate orphan `pickleball-venue-hours-v1` in Phase 1C |
| Court availability | Derived; owned as contract by Venue & Court |
| Maintenance block | `bookingType: maintenance` + master `status: maintenance` |
| Pricing và slot settings | `courtManagement` + court rate fields |
| Master status | `active` / `locked` / `maintenance` on court record (`models/court.js`) |

**Does not own:**

- Match lifecycle / `match.courtId` mutations owned by Competition
- Court Engine social queue / session lifecycle
- AI pairing / scoring decisions

---

## Competition Engine owns

| Concern | Notes |
| ------- | ----- |
| `match.courtId` | Assignment result on match entity |
| Match court assignment | `courtAssignmentEngine`, Director `courtEngine` |
| Match court transfer | Within competition runtime |
| Tournament schedule | Schedule engines / competition-core scheduling |
| Schedule publication | Competition publication flow |
| Competition runtime trạng thái trận | Match status machine |
| Conflict validation liên quan schedule giải đấu | Intra-schedule conflicts (player double-book, court double-book **within** competition) |

**Does not own:**

- Court inventory SSOT
- Booking table / Club V3 bookings blob as its own store
- Court master status writes
- Venue hours / pricing

**Must consume:**

- Venue & Court availability contract (Phase 1E/1F)
- Optional tournament booking bridge for calendar blocking

---

## Court Engine owns

| Concern | Notes |
| ------- | ----- |
| Social queue | `queueService` |
| Active session | `court_engine_active_sessions` / local store |
| Runtime assignment | Assign players/groups to courts in a session |
| Playing, paused, overrun | `COURT_RUNTIME_STATUS` |
| Runtime session lifecycle | Open/close session, timers, transfer |

**Persistence:** `court_engine_stores`, `court_engine_active_sessions` (and local fallback) — **runtime only**, not inventory.

**Does not own:**

- Court master inventory
- Booking SSOT
- Match schedule publication

**Must consume:**

- Court list from Venue & Court inventory (already partially via `courtService` / Club V3)
- Availability / master status via adapter (Phase 1)

---

## AI module owns

| Concern | Notes |
| ------- | ----- |
| Gợi ý hoặc tối ưu xếp sân trong phạm vi AI feature | Pairing / scoring / session AI |
| Session matchmaking suggestions | `ai/engine` consumers |

**Does not own:**

- Court inventory SSOT
- Availability SSOT
- Booking SSOT

**Must not:**

- Expose `loadAIData().courts` as the public courts inventory (known defect in `courtsHandler`)

---

## Allowed bridges

```text
Venue & Court availability contract
Tournament booking bridge
Court status adapter
Competition court adapter
```

| Bridge | Direction | Purpose |
| ------ | --------- | ------- |
| Availability contract | Competition / Court Engine / Booking → Venue & Court | Ask “can this court be used in this range?” |
| Tournament booking bridge | Competition → Venue & Court bookings | Sync tournament court blocks into `bookings[]` (`tournamentBookingService`) |
| Court status adapter | Master + runtime → consumers | Map master vs runtime without unifying enums |
| Competition court adapter | Competition → Venue & Court facade | Inventory/availability only; no match writes |

---

## Forbidden bridges / anti-patterns

```text
Competition đọc trực tiếp club_data_v3
Court Engine tự sửa Court master data
AI store trở thành court inventory SSOT
Venue & Court tự thay đổi match lifecycle
```

| Anti-pattern | Why forbidden |
| ------------ | ------------- |
| Competition reads `club_data_v3` blob directly | Bypasses ownership; couples schedule to storage shape |
| Court Engine writes Court master `status` / inventory | Confuses runtime with master; breaks booking invariants |
| AI store as inventory SSOT | `loadAIData` does not expose CM courts; API already wrong |
| Venue & Court mutates match lifecycle | Cross-module ownership violation |
| Duplicate courts into Competition / Court Engine stores | Creates second inventory (Phase 1 explicitly forbids) |
| Create `public.courts` / `public.bookings` in Phase 1 | Requires separate migration phase |

---

## Dependency diagram (logical)

```text
┌─────────────────────────────────────────────┐
│              Venue & Court                   │
│  venues · clusters · courts[] · bookings[]   │
│  courtManagement · availability contract     │
└───────────────┬─────────────────────────────┘
                │ consume (read / check)
     ┌──────────┼──────────┬──────────────────┐
     ▼          ▼          ▼                  ▼
 Competition  Court     Booking UI        External API
 Engine       Engine    (Court Mgmt)      (via facade)
     │          │
     │ own      │ own
     ▼          ▼
 match.courtId  runtime session
 schedule       queue / playing
```

---

## Phase 1 constraint reminder

```text
Không tạo inventory sân thứ hai.
Không migration courts/bookings sang bảng SQL.
Không rewrite Court Management.
Không rewrite Court Engine.
Không rewrite Competition scheduling.
```

Facade wraps / delegates existing services. Behavior change only where Owner-approved tasks (hours consolidation, API source correction, availability contract) explicitly require it.

---

## Related documents

- `PHASE_1A_GLOSSARY.md`
- `PHASE_1A_SSOT_DECISION.md`
- `PHASE_1A_FACADE_DESIGN.md`
- `PHASE_1A_FILE_OWNERSHIP_MATRIX.md`
