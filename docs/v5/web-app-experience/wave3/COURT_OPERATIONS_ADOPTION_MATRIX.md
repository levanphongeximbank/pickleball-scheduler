# Court / Venue Operations Adoption Matrix

`COURT_SCREEN_COUNT=13`
`COURT_ADOPT_NOW_COUNT=6`
`COURT_DOMAIN_SPECIFIC_KEEP_COUNT=3`
`COURT_DEFER_WAVE6_COUNT=1`

Venue / Court Cluster → Physical Courts is the locked authority hierarchy.

| Route / surface | Current pattern | Disposition | Priority | Responsive |
|---|---|---|---|---|
| `/court-management` | Ad-hoc overview header/cards | ADOPT_NOW | P0 | MINOR |
| `/court-management/calendar` | Layout header + domain matrix | PARTIAL_ADOPT; matrix stays domain | P1 | DEFER_WAVE6 |
| `CourtCalendarWeekMatrix` | Grid `minWidth: 900` | KEEP_DOMAIN_SPECIFIC | DEFER | W6-PAGE-001 |
| `/court-management/bookings` | Seven inline filters, MUI table, inline empty row, domain dialogs | ADOPT_NOW | P0 | MAJOR |
| `/court-management/revenue` | Finance-like operational composition | DEFER_WAVE4 | DEFER | MINOR |
| `/court-management/customers` | Inline header/actions/filter/table/Alert feedback | ADOPT_NOW (customer batch) | P0 | MAJOR |
| `/court-management/members` | Summary cards/filter/table/domain dialogs | ADOPT_NOW (customer batch) | P0 | MAJOR |
| `/court-management/customer-groups` | Small admin table | DEFER_WAVE4 | P2 | MINOR |
| `/court-management/ops-log` | Operational audit surface | DEFER_WAVE4 | P2 | MINOR |
| `/court-management/courts` | Wave 2 pilot; club transfer panel remains | PILOT_ALREADY_ADOPTED / minor normalization | P1 | NO_GAP |
| `/court-management/future` | Tournament schedule manager embedded in court page | KEEP_DOMAIN_SPECIFIC / reassess ownership | DEFER | MAJOR |
| `/select-players` | Unique AI allocation runtime; tournament animation import | PARTIAL_ADOPT | P1 | MAJOR |
| `/court-engine` | Director runtime and allocation semantics | KEEP_DOMAIN_SPECIFIC | DEFER | MAJOR |

`COURT_ADOPT_NOW_COUNT=6` counts overview, bookings, customers, members, the shared layout header/filter normalization, and selected waiting/allocation framing. The calendar is not counted as fully adopted.

## Per-screen contract

- Header: replace `CourtManagementLayout` ad-hoc `Typography h4` with one `AuthPageHeader`; keep tabs beneath it.
- Filter: wrap controls without changing query/filter values.
- Data: bookings/customers/members use `AuthResponsiveDataView`; mobile cards must retain labels.
- State: use canonical empty/loading/error states; a denied runtime is an error/authorization state, never “empty.”
- Dialog: booking/customer/member forms stay domain dialogs; confirmation-only flows use `AuthConfirmDialog`.
- Feedback/status: map only visual tones; booking, payment, membership, and court enums remain unchanged.

`W6_PAGE_001_STATUS=REMAINS_WAVE6`
