# Phase 1A — Venue & Court Glossary

**Status:** Official glossary for Venue & Court Phase 1  
**Scope:** Terminology only — no code changes  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`

---

## Core definitions

### Venue

```text
Tổ chức hoặc tenant vận hành.
Không mặc định đồng nghĩa với một sân vật lý.
```

- Persisted as venue registry (`pickleball-venues-v1` / domain `venueService`).
- Holds org metadata: `id`, `name`, `slug`, `ownerId`, `timezone`, `status`, `subscriptionId`.
- A Venue may own multiple Clubs and multiple Court Clusters.
- **Not** the physical facility; physical location is Court Cluster.

### Court Cluster

```text
Cơ sở, địa điểm hoặc cụm sân vật lý thuộc Venue.
```

- Persisted as `court_clusters` (local: `pickleball-court-clusters-v1`; cloud sync via court-cluster feature).
- Groups physical courts under a facility address / maps URL.
- Feature-flagged: `VITE_COURT_CLUSTERS_ENABLED`.
- Courts may carry optional `clusterId` on the court master record.

### Court

```text
Một đơn vị sân vật lý có courtId ổn định.
```

- Master inventory lives in `club_data_v3.data.courts[]` (Club V3 blob).
- Normalized by `src/models/court.js` (`normalizeCourt`).
- Master fields include: `id`, `name`, `number`, `active`, `status` (`active` | `locked` | `maintenance`), rates, optional `tenantId` / `clusterId`.
- Display name via `getCourtDisplayName()` — never invent display names from timestamp ids alone.

### Booking

```text
Một khoảng thời gian chiếm dụng Court.
```

- Lives in `club_data_v3.data.bookings[]`.
- Types: `single`, `recurring`, `social_play`, `tournament`, `maintenance`.
- Active blocking statuses: `pending`, `confirmed`, `checked_in`, `playing`.
- Tournament bookings are created via `tournamentBookingService` bridge (`bookingType: "tournament"`).

### Availability

```text
Kết quả đánh giá một Court có được phép sử dụng
trong một khoảng thời gian cụ thể hay không.
```

- Derived read model — not a persisted table.
- Must consider: court master status, maintenance blocks, overlapping bookings, venue/ops hours, optional cluster/venue scope.
- Phase 1 ownership: Venue & Court availability contract (designed in `PHASE_1A_AVAILABILITY_CONTRACT.md`).
- Competition / Court Engine / AI **consume** availability; they do not own it.

### Maintenance Block

```text
Khoảng thời gian Court không được sử dụng do bảo trì.
```

- Represented as a booking with `bookingType: "maintenance"` (via `createMaintenanceBooking`).
- Distinct from court master status `maintenance`, which locks the court for all new bookings until cleared.
- Both forms must fail availability checks for new assignments in the affected range.

### Runtime Court Status

```text
Trạng thái phiên vận hành của Court Engine hoặc Competition.
Không phải Court master status.
```

- Court Engine: `empty` | `assigned` | `playing` | `paused` | `overrun` | `completed` | `maintenance` | `locked` (`COURT_RUNTIME_STATUS`).
- Tournament / Director: `available` | `playing` | `locked` (`COURT_STATUS` in tournament constants).
- Runtime status must **not** be written back into Court master `status`.

### Court Assignment

```text
Việc một engine chọn Court cho một session hoặc match.
Engine không sở hữu Court inventory.
```

- Examples: Court Engine auto-assign, tournament `assignCourts` / `assignMatchToCourt`, Competition schedule assignment.
- Engines receive a court list / availability result as input; they must not invent a parallel inventory SSOT.
- Output is typically `match.courtId` or a runtime session assignment — owned by the assigning engine, not by Venue & Court inventory.

---

## Term matrix

| Thuật ngữ | Định nghĩa | Module sở hữu | Không được hiểu là |
| --------- | ---------- | ------------- | ------------------ |
| Venue | Tổ chức / tenant vận hành | Venue & Court (`venueService`, `data/venue`) | Một sân vật lý; một Court Cluster; một Club |
| Court Cluster | Cơ sở / cụm sân vật lý thuộc Venue | Venue & Court (`court-cluster`, `data/courtCluster`) | Tenant; Club; Court inventory SSOT |
| Court | Đơn vị sân vật lý, `courtId` ổn định | Venue & Court (Club V3 `courts[]`, `courtService`) | Runtime session; tournament match court field |
| Booking | Khoảng thời gian chiếm dụng Court | Venue & Court (`bookingService`, Club V3 `bookings[]`) | Match schedule row; Court Engine session |
| Availability | Kết quả đánh giá Court có dùng được trong khoảng thời gian | Venue & Court (availability contract) | Persisted table; AI suggestion list |
| Maintenance Block | Khoảng thời gian sân không dùng do bảo trì | Venue & Court (`bookingType: maintenance` + master `maintenance`) | Court Engine runtime `maintenance` alone |
| Runtime Court Status | Trạng thái phiên vận hành engine | Court Engine / Competition (own runtime) | Court master status trong inventory |
| Court Assignment | Engine chọn Court cho session/match | Competition / Court Engine / AI (assignment only) | Sở hữu court inventory hoặc booking SSOT |
| Court Management settings | Giờ mở/đóng, slot, peak, notify, automation | Venue & Court (`courtManagementSettings`) | Venue registry hours (`pickleball-venue-hours-v1`) |
| Venue hours (admin page) | Giờ theo ngày tuần per tenant (orphan store) | Admin UI only today | SSOT cho booking calendar (chưa wired) |
| Tournament booking | Booking `bookingType: tournament` đồng bộ từ lịch giải | Bridge (`tournamentBookingService`) | Inventory sân; match lifecycle |
| Plan limit `maxCourts` | Giới hạn số sân theo gói subscription | Subscription / auth guard | Availability time-window check |

---

## Naming notes (legacy vs Phase 1)

| Legacy name in code | Phase 1 preferred meaning |
| ------------------- | ------------------------- |
| `tenantId` on court | Usually Venue id for isolation |
| `venues` table/registry | Org / tenant, not facility |
| `court.status` (master) | Master status only |
| `COURT_RUNTIME_STATUS` | Court Engine session layer |
| `COURT_STATUS` (tournament) | Tournament Director runtime only |
| `loadAIData().courts` | **Not** inventory SSOT — known defect for API |

---

## Related documents

- `PHASE_1A_MODULE_BOUNDARY.md`
- `PHASE_1A_SSOT_DECISION.md`
- `PHASE_1A_STATUS_MAPPING.md`
- `PHASE_1A_AVAILABILITY_CONTRACT.md`
