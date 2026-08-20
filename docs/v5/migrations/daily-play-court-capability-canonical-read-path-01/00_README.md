# Daily Play — Court capability canonical read-path 01

```
OWNER_GO=DAILY_PLAY_COURT_CAPABILITY_CANONICAL_READ_PATH_CLOSURE_01
SELECTED_STRATEGY=CANONICAL
COMPATIBILITY_FALLBACK_USED=NO
CLUB_DATA_V3_AS_SSOT=NO
LOCALSTORAGE=DENY
PRODUCTION_APPLY=NO
PR444_TOUCH=NO
MERGE_GO=NO
```

## Root cause

Staging Daily `daily_play_read_courts` owned Court eligibility itself and read
only `club_data_v3.data.courts` (flat). Tenant A Daily club
`club-ecebf64c78f948ccb2b59842441eb26c` stores courts under nested
`data.data.courts` (length 2), so the Daily reader returned `[]` and create-match
preflight failed with `NO_COURT_CAPABILITY`.

Canonical inventory is already present for that club:

- `court_resource_physical_courts` — 2 active Tenant A rows
- `court_resource_club_operational_access` — 2 enabled rows

Strategy B (blob compatibility) is therefore **not** selected.

## Architecture

```
Daily Play
  → daily_play_read_courts (thin Daily projection only)
    → court_resource_list_eligible_courts (Court-owned reader)
      → court_resource_physical_courts
      + court_resource_club_operational_access
      → physicalCourtId
```

Daily does **not** query `court_resource_*` tables.
Daily does **not** parse `club_data_v3`.
`clusterId` remains topology/filter only.

## Tenant / Venue

```
TENANT_ID_FROM_VENUE_ID_INFERENCE=DENY
VENUE_AS_TENANT_FALLBACK=DENY
COURT_CLUSTER_TENANT_AUTHORITY=court_clusters.tenant_id
COURT_CLUSTER_VENUE_AUTHORITY=court_clusters.venue_id
CLUB_TENANT_AUTHORITY=clubs.tenant_id
AUTHORIZATION=is_super_admin() OR profiles.tenant_id = p_tenant_id
```

This package **does not** copy `court-resource-canonical-inventory-read-01`
unchanged. That historical reader used `user_venue_id()` as Tenant proof and
(before Batch 8) `court_clusters.venue_id` as Tenant proof. Both are denied here.

`user_tenant_id()` is also denied: it still COALESCE-falls back to `profiles.venue_id`.

## Daily projection

`daily_play_read_courts(p_club_id, p_enabled_court_ids)` keeps its existing
signature so create/assign/snapshot callers stay unchanged.

It resolves `clubs.tenant_id` for the club, delegates to the Court reader, then
projects Daily-required fields. Canonical identity remains `physicalCourtId`.
`id` / `courtId` are **boundary-local compatibility aliases** equal to
`physicalCourtId` so existing Daily lease/assign (`coalesce(id, courtId)`)
consumes canonical identity without a second court master.

Session `enabledCourtIds` remain a Daily allow-list projection, not Court
eligibility authority.

## Security

| Function | anon | authenticated | service_role |
| -------- | ---- | ------------- | ------------ |
| `court_resource_list_eligible_courts` | REVOKE | GRANT | GRANT (JWT still required except superuser SQL) |
| `daily_play_read_courts` | REVOKE | REVOKE | GRANT (internal Daily helper; not a browser RPC) |

Both functions: `SECURITY DEFINER`, `search_path = pg_catalog, public`.
No table GRANTs. No RLS bypass from browser.

## Apply order (Staging only, after exact-head CI)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` restores the pre-package function bodies only.
It never deletes court, club, player, or profile rows.

## Exit / non-goals

- No fake courts, no court backfill, no `club_data_v3` rewrite
- No Production access
- No PR #444 / CORE13 fixture mutation
- Contract #07 unchanged
- Compatibility blob path is **not** implemented; retire-criteria if it were:
  canonical physical court rows + enabled club operational access fully
  available for Daily-selected clubs
