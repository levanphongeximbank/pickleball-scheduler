# Phase 1A — SSOT Decision Record

**Status:** Temporary SSOT decision for Phase 1  
**Scope:** Decision record only — no migration, no schema change  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`

---

## Decision (Phase 1)

```text
Phase 1 tiếp tục sử dụng Club V3 courts/bookings
làm nguồn dữ liệu kế thừa hiện tại.
```

**Rationale (verified in Phase 1A audit):**

1. There is **no** `public.courts` table.
2. There is **no** `public.bookings` table.
3. Court Management, booking calendar, tournament booking bridge, and courtService already read/write Club V3 blob.
4. Creating a second inventory before a facade would increase Production risk.
5. Competition and Court Engine already treat courts as inputs; they should not become owners.

---

## Current SSOT

```text
Court inventory:
club_data_v3.data.courts[]

Booking:
club_data_v3.data.bookings[]

Court operations settings:
courtManagement settings

Venue:
venues

Physical facility grouping:
court_clusters
```

### Persistence map

| Concern | Local key / path | Cloud |
| ------- | ---------------- | ----- |
| Court inventory | `pickleball-club-data-v3::{clubId}` → `data.courts[]` | `public.club_data_v3` JSON blob |
| Booking | same blob → `data.bookings[]` | same |
| Court ops settings | same blob → `data.courtManagement` | same |
| Recurring series | same blob → recurring series field | same |
| Venue registry | `pickleball-venues-v1` | not first-class SQL inventory |
| Active venue | `pickleball-active-venue-v1` | session pointer |
| Court clusters | `pickleball-court-clusters-v1` (+ assignments / active) | cluster cloud sync / `court_clusters` |
| Court Engine runtime | local CE store / `court_engine_stores` | `court_engine_stores`, `court_engine_active_sessions` |
| Venue hours (orphan) | `pickleball-venue-hours-v1::{tenantId}` | local only today |

### Access paths (approved for Phase 1 substrate)

| Operation | Preferred entry |
| --------- | --------------- |
| Load/save courts | `clubStorage.loadCourtsForClub` / `saveCourtsForClub` |
| Load/save bookings | `clubStorage.loadBookingsForClub` / `saveBookingsForClub` |
| Venue-scoped court list | `courtService.loadCourtsForVenue*` |
| Booking CRUD / status | `bookingService` |
| Conflict / pricing / slots | `courtBookingEngine` (pure) |
| Ops hours / slots | `courtManagementSettings` |
| Tournament → bookings | `tournamentBookingService` |
| Clusters | `features/court-cluster` + `data/courtCluster` |

---

## Không được tạo trong Phase 1

* Không tạo localStorage key mới cho court inventory.
* Không tạo JSON blob mới.
* Không tạo Supabase `courts` hoặc `bookings`.
* Không sao chép courts vào Competition Engine.
* Không sao chép courts vào Court Engine.
* Không dùng AI store làm nguồn chính.

### Known non-SSOT / defective paths (record only — fix in later Phase 1 tasks)

| Path | Issue | Target fix phase |
| ---- | ----- | ---------------- |
| `courtsHandler` → `loadAIData().courts` | AI view does not expose Court Management courts; API list effectively empty / wrong | Phase 1D |
| `pickleball-venue-hours-v1` | Orphan; not consumed by booking calendar | Phase 1C |
| Court Engine / Tournament runtime statuses | Not master SSOT; must not overwrite `courts[].status` | Status mapping (1A design; enforce later) |

---

## Dual hours problem (decision for Phase 1C)

| Source | Shape | Used by booking? |
| ------ | ----- | ---------------- |
| `courtManagement.openHour` / `closeHour` | Integer hours 0–24 | **Yes** — calendar, slots, utilization |
| `pickleball-venue-hours-v1::{tenantId}` | Per weekday open/close strings | **No** — only `VenueHoursPage` |

**Phase 1 temporary rule:** Court Management hours remain the operational SSOT for availability and booking until Phase 1C consolidates VenueHoursPage onto the same service (with backward compatibility). Do not invent a third hours store.

---

## Roadmap sau Phase 1

Future option (documented only):

```text
public.courts
public.bookings
```

**Markers (mandatory):**

```text
NOT APPROVED
NOT IN PHASE 1
REQUIRES SEPARATE MIGRATION PHASE
```

Any SQL migration of courts/bookings out of Club V3 requires:

1. Separate Owner approval
2. Dedicated migration phase with dual-read / dual-write plan
3. Production rollback plan
4. Competition / Court Engine / API consumer audit

Until then, Club V3 remains the inherited substrate.

---

## Decision summary

| Question | Answer |
| -------- | ------ |
| Where is court inventory SSOT? | `club_data_v3.data.courts[]` |
| Where is booking SSOT? | `club_data_v3.data.bookings[]` |
| Create SQL courts/bookings in Phase 1? | **No** |
| Create second blob/key? | **No** |
| AI store as inventory? | **No** |
| Facade role? | Wrap / delegate existing loaders — do not duplicate storage |

---

## Related documents

- `PHASE_1A_MODULE_BOUNDARY.md`
- `PHASE_1A_FACADE_DESIGN.md`
- `PHASE_1_IMPLEMENTATION_TASKS.md`
