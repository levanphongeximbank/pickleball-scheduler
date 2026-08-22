# Batch 3B — Court / Daily Operations adoption matrix

**Scope:** `/court-management`, `/court-management/calendar`, `/court-management/bookings`, `/mobile/check-in`

## Adoption

| Route | Canonical adoption | Domain composition preserved | Safety result |
|---|---|---|---|
| `/court-management` | `AuthPageHeader` | `MyFacilityPanel`, `LiveCourtsHero`, `CourtStats`, `CourtStatusBoard`, `DirectorSuggestionPanel` | Venue/cluster → physical-court hierarchy and operational actions unchanged |
| `/court-management/calendar` | `AuthPageHeader`; opt-in `AuthFilterBar` around the existing toolbar | Day grid, month board, booking forms, booking detail, calendar KPI logic | `CourtCalendarWeekMatrix.jsx` unchanged; `W6-PAGE-001` remains Wave 6 |
| `/court-management/bookings` | `AuthPageHeader`, `AuthFilterBar`, `AuthResponsiveDataView`, `AuthEmptyState` through the data view, `StatusToneChip` | Existing filters, URL `q`, sort, CSV, `BookingForm`, `BookingDetail`, permission gate | Eight displayed fields retained; data source and mutation paths unchanged |
| `/mobile/check-in` | `AuthPageHeader`, `AuthFilterBar`, `AuthResponsiveDataView`, `AuthEmptyState`, `AppSnackbar`; domain chip delegates visual tone to `StatusToneChip` | QR links, dashboard service, offline snapshot, queue, flush/retry and scan history | QR, offline queue, sync and mutation semantics unchanged |

## Domain and shared-layer locks

- Shared components only render composition.
- Booking filtering, URL-query hydration, sorting and booking rules remain in `BookingList`.
- Check-in enums and status-label/color mapping remain in the mobile domain.
- Booking display status remains decided by `getBookingDisplayStatus`.
- No route, authorization, writer, backend, database, RLS, Public Web, Tournament Experience 23 or Wave 1 shell change.

## Cross-domain cleanup

`/mobile/check-in` no longer imports `MOBILE_PAGE_GUTTER` from Tournament UI. It uses the authenticated workspace spacing grid. No other inappropriate cross-domain import existed in the four-route scope.

`BATCH3B_CROSS_DOMAIN_LEAK_PRE=1`  
`BATCH3B_CROSS_DOMAIN_LEAK_POST=0`

## Accessibility

- One canonical `h1` per scoped view.
- Booking and check-in filters have visible labels and linked select labels.
- Booking detail action has a row-specific accessible name.
- Check-in tabs have an accessible group name.
- Statuses retain visible text and do not rely on color alone.
- QR and sync actions retain visible accessible names.
- Responsive booking/check-in data retains explicit field labels.

`BATCH3B_A11Y_CRITICAL_GAPS=0`
