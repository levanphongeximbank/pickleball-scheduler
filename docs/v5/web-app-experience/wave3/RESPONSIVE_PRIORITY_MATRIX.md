# Responsive Priority Matrix

Static audit targets: 1440, 1024, 430; spot-check 390. Wave 1 shell debt is excluded.

| Routes / surface | 1440 | 1024 | 430 / 390 | Classification |
|---|---|---|---|---|
| Dashboard pilot | stable grids | stable 2-column | stacked | NO_GAP |
| Court overview | stable | stable | stacked | MINOR |
| Court calendar matrix | full matrix | horizontal matrix | `minWidth:900` scroll | DEFER_WAVE6 |
| Bookings | wide table | compressed filters/table | table overflow risk | MAJOR |
| Customers | table | compressed | no mobile data view | MAJOR |
| Members | table + cards | compressed | eight-column table | MAJOR |
| Check-in | responsive data view | stable | mobile-first | MINOR |
| Select players | multi-panel | dense | long workflow stacking | MAJOR |
| Player detail / skill | stable | stable | tournament layout coupling | MINOR |
| Club shell pages | max-width content | stable | actions stack | MINOR |
| Coaching entity routes | table | table | no mobile card labels | MAJOR |
| Tournament list / my / types | domain grids/tables | wrap | outer table/action density | MINOR |

## Wave 3 acceptance

- No new page-level horizontal overflow at 1024, 430, or 390.
- `AuthResponsiveDataView` mobile cards expose every material field label.
- Filter/actions wrap without changing order or filter semantics.
- Touch actions target at least 44px unless a dense secondary icon action has an equivalent labeled row/menu action.
- Screenshot evidence for each batch uses 1440, 1024, 430 and one 390 spot-check per implementation family.

`W6_PAGE_001_STATUS=REMAINS_WAVE6`
