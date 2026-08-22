# Check-in / Waitlist / Booking Operations Matrix

`OPERATIONS_SCREEN_COUNT=7`
`OPERATIONS_ADOPT_NOW_COUNT=2`

| Route | Header | Filter/data/state today | Adoption |
|---|---|---|---|
| `/court-management/bookings` | Parent ad-hoc header | Dense inline filters + desktop table + inline empty | ADOPT_NOW |
| `/mobile/check-in` | Ad-hoc h5 | Mobile-local filter, responsive data, status chip, `window.alert` | ADOPT_NOW |
| `/select-players` | Workflow composition | Unique player/court pickers, result and animation | KEEP_DOMAIN_SPECIFIC |
| `/mobile/operations` | Mobile-local | Operational cards and tournament gutter | PARTIAL_ADOPT |
| `/court-management` | Ad-hoc overview | Operational cards/state | PARTIAL_ADOPT |
| `/mobile/qr-scan` | Mobile runtime | Scanner lifecycle and feedback | KEEP_DOMAIN_SPECIFIC |
| `/mobile/qr-generate` | Mobile runtime | QR generation lifecycle | KEEP_DOMAIN_SPECIFIC |

The two immediate targets are booking and operator check-in. Waiting/allocation, mobile operations, and court overview retain domain composition with later framing-only adoption.

## Required mappings

- Booking and check-in filters → `AuthFilterBar`.
- Booking/check-in data → `AuthResponsiveDataView`; desktop tables and labeled mobile cards.
- Booking/check-in status visuals → `StatusToneChip` wrappers; enums unchanged.
- Empty/loading/error → canonical states with offline, denied, and empty kept distinct.
- Transient success/conflict feedback → `AppSnackbar`; persistent offline/conflict banners remain `Alert`.
- Confirmation-only actions → `AuthConfirmDialog`; booking/customer/member forms and QR/scanner surfaces remain domain dialogs/runtimes.

## Safety

Booking creation/update, payment state, court assignment, check-in authority, offline queue conflict handling, player/court selection, AI scheduling, locks, and commit semantics remain unchanged.
