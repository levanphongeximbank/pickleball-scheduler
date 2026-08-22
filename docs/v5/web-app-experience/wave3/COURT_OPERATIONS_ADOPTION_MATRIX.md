# Court / Venue Operations Adoption Matrix

`COURT_SCREEN_COUNT=12`
`COURT_ADOPT_NOW_COUNT=2`
`COURT_DOMAIN_SPECIFIC_KEEP_COUNT=3`
`COURT_DEFER_WAVE6_COUNT=1`

Venue / Court Cluster → Physical Courts is the locked authority hierarchy.

| Route / surface | Current pattern | Disposition | Priority | Responsive |
|---|---|---|---|---|
| `/court-management` | Ad-hoc overview header/cards | PARTIAL_ADOPT | P1 | MINOR |
| `/court-management/calendar` | Domain toolbar, day/week/month views, raw feedback | ADOPT_NOW; matrix stays domain | P0 | DEFER_WAVE6 |
| `CourtCalendarWeekMatrix` | Grid `minWidth: 900` | KEEP_DOMAIN_SPECIFIC | DEFER | W6-PAGE-001 |
| `/court-management/bookings` | Seven inline filters, MUI table, inline empty row, domain dialogs | ADOPT_NOW | P0 | MAJOR |
| `/court-management/courts` | Wave 2 pilot; club transfer panel remains | PILOT_ALREADY_ADOPTED / minor normalization | P1 | NO_GAP |
| `/court-management/calendar/preview` | In-memory design preview | FROZEN | DEFER | same shell |
| Booking detail check-in | Embedded status action, not a route | KEEP_DOMAIN_SPECIFIC | P1 | dialog gap |
| `/mobile/check-in` | Mobile responsive list/offline queue | PARTIAL_ADOPT | P1 | MINOR |
| `/mobile/operations` | Mobile operational cards/shortcuts | PARTIAL_ADOPT | P2 | MINOR |
| `/select-players` | Unique AI allocation runtime; tournament animation import | KEEP_DOMAIN_SPECIFIC | P1 | MAJOR |
| `/court-engine` | Director runtime and allocation semantics | KEEP_DOMAIN_SPECIFIC | P1 | MAJOR |
| `/admin/court-clusters` | Cluster claim/admin table and dialogs | PARTIAL_ADOPT | P2 | MAJOR |
| `/admin/hours` | Venue operating-hours form/table | PARTIAL_ADOPT | P2 | MINOR |

`COURT_ADOPT_NOW_COUNT=2` counts production calendar and bookings. Customer/member routes are counted in the Customer/Player matrix; admin and runtime surfaces are partial/domain/deferred.

## Per-screen contract

- Header: replace `CourtManagementLayout` ad-hoc `Typography h4` with one `AuthPageHeader`; keep tabs beneath it.
- Filter: wrap controls without changing query/filter values.
- Data: bookings use `AuthResponsiveDataView`; mobile cards must retain labels.
- State: use canonical empty/loading/error states; a denied runtime is an error/authorization state, never “empty.”
- Dialog: booking forms/details stay domain dialogs; confirmation-only flows use `AuthConfirmDialog`.
- Feedback/status: map only visual tones; booking, payment, membership, and court enums remain unchanged.

`W6_PAGE_001_STATUS=REMAINS_WAVE6`
