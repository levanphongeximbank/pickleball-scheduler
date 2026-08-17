# Platform Core Wave 3 — Tenant / Venue Separation

**Status:** Phase A app remediation landed in this branch. Phase B SQL is **authored for Owner review only**.

**SQL_EXECUTION_GO=NO** — do not apply until Owner explicitly authorizes.

## Architecture lock

- Tenant ≠ Venue
- Venue ≠ Cluster
- Cluster ≠ Physical Court
- Club ≠ Venue
- Organization = NOT_CONFIGURED (no Organization implementation)
- Contract #02 / #07 frozen (no contract edits in this wave)

## Target cardinality

`Tenant → Venue = 1:N`

## Phase A (app — this PR)

- Distinct `VenueContext` under `TenantProvider`
- Cluster scoped by `currentVenueId`
- Club remains tenant-scoped; club switch does not mutate Tenant/Venue/Cluster identity
- User-scoped venue preference; cleared on logout / user switch / auth_invalid
- Tenant registry (`pickleball-tenants-v1`) distinct from venue registry
- Readiness supports optional `requireVenue` (not global)

## Phase B (SQL package — review only)

See `sql/`:

| File | Purpose |
|------|---------|
| `00_OWNER_README.md` | Apply order, risks, GO gate |
| `01_PRECHECK.sql` | Read-only inventory |
| `02_APPLY_platform_tenants_and_venue_fk.sql` | Real tenants table + venues.tenant_id + profiles.tenant_id |
| `03_BACKFILL.sql` | 1:1 bootstrap backfill (safe starting point for 1:N) |
| `04_RLS_NOTES.sql` | RLS policy notes / drafts |
| `05_VERIFY.sql` | Post-apply verification |
| `99_ROLLBACK.md` | Rollback guidance |

## Contracts

SHARED_CONTRACT_CAPABILITY_GAP remains suspected for Venue-first-class on #02 and venue parent on #07.
**No contract modification authorized** without separate Owner GO.
