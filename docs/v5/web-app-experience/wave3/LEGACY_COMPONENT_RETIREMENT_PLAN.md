# Legacy Component Retirement Plan

Audit only: `SAFE_DELETE_NOW=NO` for every entry.

| Legacy component / family | Current usage count | Replacement | Delete after Wave 3 | Defer |
|---|---:|---|---|---|
| `ClubPageShell` | 9 JSX call sites | `AuthPageHeader` + club max-width wrapper | YES, after zero imports | NO |
| `ClubConfirmDialog` | 2 | `AuthConfirmDialog` | YES | NO |
| `ClubEmptyState` | 5 | `AuthEmptyState` with club copy | YES | NO |
| `ClubFeedbackAlert` | 4 | `AppSnackbar` or persistent MUI Alert | CONDITIONAL | YES for persistent alert use |
| mobile `ResponsiveDataView` | 1 page use | `AuthResponsiveDataView` | YES after mobile parity | NO |
| `TournamentPageHeader` outside tournament | 2 pages | `AuthPageHeader` | remove non-tournament imports only | tournament component stays |
| tournament layout imports outside tournament | 5 files | auth tokens / local domain layout | remove imports | tournament module stays |
| tournament `mobileUi` outside tournament | 7 pages | neutral auth/mobile layout contract | NO | ownership extraction |
| coaching native confirm | 1 shared implementation | `AuthConfirmDialog` | YES | NO |
| ad-hoc coaching table/state/header family | 1 implementation serving 7 routes | canonical auth patterns | YES after route certification | NO |
| dashboard local `StatCard` and club-operation states | 4 legacy families | retain KPI composition; canonical generic states/tones | CONDITIONAL | KPI redesign deferred |
| `ClubDataTransferPanel` inside Courts | 1 | club-owned entry/composition | NO | ownership decision |

Deletion gates:

1. all call sites migrated;
2. targeted tests and route smoke pass;
3. no public/Tournament Experience dependency;
4. owner approves deletion in an implementation batch;
5. `git grep` equivalent confirms zero imports.

No component is deleted in Batch 3A.
