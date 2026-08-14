# btree_gist prerequisite for Official canonical court reservation

**LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO.**

Staging read (2026-08-14): `btree_gist` is **available** (`default_version=1.7`) but **not installed** (`installed_version=null`).

This package is the only place that installs the extension. The business schema package does **not** `CREATE EXTENSION`.

## Run order

1. `01_PRECHECK.sql` — read only
2. `02_APPLY.sql` — `CREATE EXTENSION btree_gist`
3. `03_VERIFY.sql` — read only
4. `04_ROLLBACK.sql` — fail-closed if `court_reservations` exclusion constraint depends on it
