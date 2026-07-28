# Reseed package — order & safety

**Status:** Source-controlled. **NOT EXECUTED** in pre-Staging capability remediation.
**Marker dependency:** Staging rehearsal resumes only after Owner GO + fresh backup.

## Absolute rules

1. Idempotent or duplicate-detecting (`hard-cutover-seed::{tenant}::{entity}`).
2. **No** Auth user creation.
3. **No** Owner UUID change.
4. **No** protected-object mutation (`auth.users`, Owner `venues`/`tenant_members`, RBAC catalog, plans).
5. Exact verify scripts after each step.
6. Exact dependency order below.
7. This workstream does **not** run SQL against Staging or Production.

## Dependency order

| Step | File | Depends on |
|------|------|------------|
| 01 | `01_OWNER_TENANT_VERIFY_ONLY.sql` | — (VERIFY ONLY) |
| 02 | `02_CLUB.sql` | 01 |
| 03 | `03_VENUE.sql` | 02 |
| 04 | `04_COURTS.sql` | 03 |
| 05 | `05_PLAYER.sql` | 02 |
| 06 | `06_RATING_PROFILE.sql` | 05 |
| 07 | `07_COMPETITION.sql` | 02 (M8 applied) |
| 08 | `08_PARTICIPANTS.sql` | 07, 05 |
| 09 | `09_SCHEDULE.sql` | 07 |
| 10 | `10_MATCH.sql` | 09 |
| 11 | `11_FINALIZED_RESULT.sql` | 10 (SSOT RPC only) |
| 12 | `12_PUBLIC_CATALOG.sql` | 02, 04 |
| 13 | `13_CUSTOMER.sql` | 01 |
| 14 | `14_CRM.sql` | 13 |
| 15 | `15_FINANCE.sql` | 01 |
| 16 | `16_NEWS.sql` | 01 |
| 17 | `17_COACHING_FIRST_USE.sql` | 02 |
| 99 | `99_VERIFY_RESEED.sql` | all |

## Six global criteria (post-reseed live acceptance)

- `ONE_CANONICAL_WRITER_PER_DOMAIN`
- `NO_LEGACY_WRITER`
- `NO_LOCALSTORAGE_AUTHORITY`
- `NO_MOCK_PERSISTENCE`
- `NO_SILENT_FALLBACK`
- `NO_HYBRID_RUNTIME`
