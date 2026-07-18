# Phase 1A — QA Matrix

**Status:** Design QA matrix for Phase 1E–1G verification  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`  
**Note:** Not executed in Phase 1A (docs only).

---

## Conventions

| Column | Meaning |
| ------ | ------- |
| Cluster flag | `VITE_COURT_CLUSTERS_ENABLED` |
| Court Engine store | `local` \| `supabase` \| `n/a` |
| Booking type | `none` \| `single` \| `recurring` \| `tournament` \| `maintenance` |
| Expected | Availability / assignment gate outcome |

Default safety: **FAIL CLOSED** when data cannot be loaded.

---

## Matrix

| # | Scenario | Cluster flag | Court Engine store | Booking type | Expected |
| - | -------- | ------------ | ------------------ | ------------ | -------- |
| 1 | Court active, không booking | off | n/a | none | `available: true` (inside hours) |
| 2 | Court locked (master) | off | n/a | none | `available: false`, `COURT_LOCKED` |
| 3 | Court maintenance (master) | off | n/a | none | `available: false`, `COURT_MAINTENANCE` |
| 4 | Maintenance booking overlaps range | off | n/a | maintenance | `available: false`, `MAINTENANCE_BOOKING` |
| 5 | Booking thường bị trùng | off | n/a | single | `available: false`, `BOOKING_CONFLICT` |
| 6 | Tournament booking bị trùng | off | n/a | tournament | `available: false`, `TOURNAMENT_BOOKING_CONFLICT` |
| 7 | Hai booking chạm biên thời gian (`08–09` + `09–10`) | off | n/a | single | `available: true` for second range (no overlap) |
| 8 | Ngoài giờ mở cửa | off | n/a | none | `available: false`, `OUTSIDE_VENUE_HOURS` |
| 9 | Cluster flag tắt; `clusterId` ignored / optional | **off** | n/a | none | No `CLUSTER_MISMATCH`; inventory by club/venue only |
| 10 | Cluster flag bật; court wrong cluster | **on** | n/a | none | `available: false`, `CLUSTER_MISMATCH` when `clusterId` required |
| 11 | Court Engine local; court empty runtime | off | **local** | none | Availability true (if master/bookings OK); CE assign allowed |
| 12 | Court Engine Supabase; store readable | off | **supabase** | none | Same as #11 when store healthy; if store unreadable and runtime check required → fail closed |
| 13 | Court đang có runtime session (`playing`) | off | local or supabase | none | New assignment from **other** context blocked (`RUNTIME_OCCUPIED` or engine guard); master status unchanged |
| 14 | Court không tồn tại | off | n/a | none | `available: false`, `COURT_NOT_FOUND` |
| 15 | Court thuộc venue khác | off | n/a | none | `available: false`, `VENUE_MISMATCH` |
| 16 | Court thuộc cluster khác (flag on) | **on** | n/a | none | `available: false`, `CLUSTER_MISMATCH` |
| 17 | Booking recurring (expanded instance overlaps) | off | n/a | recurring | `available: false`, `BOOKING_CONFLICT` on that date instance |
| 18 | Dữ liệu booking không tải được | off | n/a | n/a | `available: false`, `DATA_UNAVAILABLE` — **never** true |
| 19 | Competition yêu cầu hai match cùng sân cùng giờ | off | n/a | none or tournament | Competition validator rejects double-book; availability false if tournament bookings already synced for both |
| 20 | Giới hạn `maxCourts` | off | n/a | none | **Does not** affect availability of existing courts; create/add court path still blocked by subscription guard |

---

## Extended checks (recommended in 1G)

| Scenario | Expected |
| -------- | -------- |
| Court `active: false` | `COURT_INACTIVE` |
| Cancelled booking overlaps | Ignored — may be available |
| Completed / no_show booking | Ignored |
| Edit booking with `excludeBookingId` | Self not treated as conflict |
| API GET `/courts` after 1D | Returns Club V3 courts, not AI empty view |
| VenueHoursPage after 1C | Same hours source as booking slots |
| Touching maintenance end == request start | Allowed (same overlap rule) |
| Invalid `endTime <= startTime` | `INVALID_TIME_RANGE` |
| Fail-open regression attempt | Must fail test suite |

---

## Feature flag matrix (1G)

| Flag / mode | Cases to run |
| ----------- | ------------ |
| Clusters off | #1–8, #14–15, #17–20 |
| Clusters on | #9–10, #16 + subset of #1–8 |
| CE local | #11, #13 |
| CE supabase | #12, #13 |
| API scoped club | 1D consumer smoke |

---

## Execution notes

1. Prefer unit tests against pure availability service with fixtures (no Production writes).
2. Integration tests may use local Club V3 fixtures — not Production Supabase mutation.
3. Preview QA before any Production smoke.
4. Production smoke: read-only availability + API list only unless Owner approves write paths.

---

## Related documents

- `PHASE_1A_AVAILABILITY_CONTRACT.md`
- `PHASE_1A_STATUS_MAPPING.md`
- `PHASE_1_IMPLEMENTATION_TASKS.md`
