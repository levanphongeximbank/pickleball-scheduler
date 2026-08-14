# Official / Open — canonical court reservation cutover 01

**LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.**

This package does **not** replay Daily Play `#424`.
`public.daily_play_court_leases` is an **existing** runtime authority.

`btree_gist` is **not** installed by this package. Staging currently has the
extension available but not installed. Apply the sibling prerequisite first:

`docs/v5/migrations/official-open-canonical-court-reservation-01-btree-gist-prereq/`

## Run order after Owner GO Staging

1. btree_gist prerequisite PRECHECK → APPLY → VERIFY
2. `01_PRECHECK.sql` — read only
3. `02_APPLY_SCHEMA.sql` — schema/functions only, one transaction
4. `03_VERIFY_SCHEMA.sql` — read only
5. `04_BACKFILL_PRECHECK.sql` — read only
6. `05_BACKFILL.sql` — Owner-controlled Official blob backfill (idempotent)
7. `06_VERIFY.sql` — read only
8. Rollback via `07_ROLLBACK.sql` when no runtime reservations exist

`02_APPLY.sql` / `03_VERIFY.sql` / `04_ROLLBACK.sql` are fail-closed pointers.
Do not apply them.

## Rollback

- Restores exact Daily `#424` `daily_play_assign_court` / `daily_play_change_court` bodies
- Restores pre-package `canonical_tournament_update` (4-arg)
- Deletes unmutated `origin=package_backfill` rows only
- Fail-closed if `origin=runtime` rows or mutated backfill rows exist
