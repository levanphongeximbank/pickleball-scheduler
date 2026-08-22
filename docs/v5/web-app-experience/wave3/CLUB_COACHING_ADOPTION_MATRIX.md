# Club / Coaching Adoption Matrix

`CLUB_COACHING_SCREEN_COUNT=16`
`CLUB_ADOPT_NOW_COUNT=8`
`CLUB_SHARED_DUPLICATE_COUNT=4`

| Routes | Current composition | Disposition |
|---|---|---|
| `/club` | Legacy club/season/league tabs with legitimate tournament round/season panels | ADOPT_NOW framing only |
| `/my-club` | `ClubPageShell`, `ClubConfirmDialog`, club feedback | ADOPT_NOW via canonical adapters |
| `/discover-clubs` | `ClubPageShell` + club feedback/empty | ADOPT_NOW |
| `/my-club/requests` | Club confirm/empty inside domain panel | ADOPT_NOW |
| `/manage/clubs` | `ClubPageShell`, registry skeleton/empty, domain forms | ADOPT_NOW |
| `/manage/clubs/:clubId` | Governance-heavy detail | PARTIAL_ADOPT |
| `/platform/clubs` | Admin registry with Club UI | ADMIN / DEFER_WAVE4 |
| `/coaching/coaches` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/students` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/classes` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/schedule` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/packages` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/attendance` | Shared `CoachingEntityPage` | ADOPT_NOW |
| `/coaching/evaluations` | Shared `CoachingEntityPage` | DEFER_WAVE4 after first six certify |
| `/coaching/coach-list` | Player-facing coach discovery | KEEP_DOMAIN_SPECIFIC |
| `/coaching/register` | Package registration workflow | KEEP_DOMAIN_SPECIFIC |

The eight-count is bounded by implementation units: five club entry screens, the reusable coaching entity implementation serving six routes, plus targeted club detail and membership normalization. Route-level proposed scope remains the 22-screen list in the master inventory.

## Duplicate families

| Club-only family | Current call sites | Canonical replacement | Retirement |
|---|---:|---|---|
| `ClubPageShell` | 9 | `AuthPageHeader` plus domain-owned max-width wrapper | after Wave 3 |
| `ClubConfirmDialog` | 2 | `AuthConfirmDialog` | after Wave 3 |
| `ClubEmptyState` | 5 | `AuthEmptyState` with club copy/icon | after Wave 3 |
| `ClubFeedbackAlert` | 4 | `AppSnackbar` for transient feedback; MUI Alert for persistent errors | after Wave 3 |

`ClubStatusBadge`, governance chips, registry skeletons, club cards, forms, org chart, and membership compositions remain domain-specific.

## Coaching leverage

`CoachingEntityPage` is one implementation shared by seven route wrappers. Adopt the canonical header/loading/error/empty/responsive-data/confirm patterns there once, then certify each route independently. Replace native `window.confirm` without moving `useCoachingCollection`, ACL, concurrency handling, or writers.
