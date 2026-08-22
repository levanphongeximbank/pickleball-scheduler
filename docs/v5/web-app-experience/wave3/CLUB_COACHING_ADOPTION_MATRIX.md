# Club / Coaching Adoption Matrix

`CLUB_COACHING_SCREEN_COUNT=18`
`CLUB_ADOPT_NOW_COUNT=12`
`CLUB_SHARED_DUPLICATE_COUNT=7`

| Routes | Current composition | Disposition |
|---|---|---|
| `/club` | Legacy club/season/league tabs with legitimate tournament round/season panels | DEFER_LEGACY_CONVERGENCE |
| `/my-club` | `ClubPageShell`, `ClubConfirmDialog`, club feedback | ADOPT_NOW via canonical adapters |
| `/discover-clubs` | `ClubPageShell` + club feedback/empty | DEFER_WAVE4 |
| `/my-club/requests` | Club confirm/empty inside domain panel | ADOPT_NOW |
| `/manage/clubs` | `ClubPageShell`, registry skeleton/empty, domain forms | ADOPT_NOW |
| `/manage/clubs/:clubId` | Governance-heavy detail | ADOPT_NOW shell |
| `/manage/clubs/:clubId?tab=members` | Fail-closed member roster, pending queue, confirm dialogs | ADOPT_NOW responsive data/confirm |
| `/my-club?view=members` | Read-only member table/mobile cards | PARTIAL_ADOPT as reference |
| `/platform/clubs` | Read-only cross-tenant registry with Club UI | ADOPT_NOW with `/manage/clubs` |
| `/coaching/coaches` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/students` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/classes` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/schedule` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/packages` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/attendance` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/evaluations` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/coach-list` | Player-facing coach discovery | KEEP_DOMAIN_SPECIFIC |
| `/coaching/register` | Package registration workflow | KEEP_DOMAIN_SPECIFIC |

The twelve selected routes/surfaces are `/manage/clubs`, `/platform/clubs`, club detail/member roster, `/my-club`, `/my-club/requests`, and the seven `CoachingEntityPage` wrappers. Route-level proposed scope remains the 22-screen list in the master inventory.

## Duplicate families

| Club-only family | Current call sites | Canonical replacement | Retirement |
|---|---:|---|---|
| `ClubPageShell` | 9 | `AuthPageHeader` plus domain-owned max-width wrapper | after Wave 3 |
| `ClubConfirmDialog` | 2 | `AuthConfirmDialog` | after Wave 3 |
| `ClubEmptyState` | 5 | `AuthEmptyState` with club copy/icon | after Wave 3 |
| `ClubFeedbackAlert` | 4 | `AppSnackbar` for transient feedback; MUI Alert for persistent errors | after Wave 3 |
| `ClubRegistrySkeleton` / `ClubDiscoverSkeleton` | 3 consumer files | `AuthLoadingState` where skeleton detail is not material | conditional |
| `ClubStatusBadge` | 3 consumer files | `StatusToneChip` with club-owned tone mapping | after Wave 3 |
| inline registry filter/table family | 2 near-identical registry pages | `AuthFilterBar` + `AuthResponsiveDataView` | after Wave 3 |

`ClubStatusBadge`, governance chips, registry skeletons, club cards, forms, org chart, and membership compositions remain domain-specific.

## Coaching leverage

`CoachingEntityPage` is one implementation shared by seven route wrappers. Adopt the canonical header/loading/error/empty/responsive-data/confirm patterns there once, then certify each route independently. Replace native `window.confirm` without moving `useCoachingCollection`, ACL, concurrency handling, or writers.
