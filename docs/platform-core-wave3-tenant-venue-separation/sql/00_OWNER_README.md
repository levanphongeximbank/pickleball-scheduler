# Owner SQL package — Wave 3 Phase B

**SQL_EXECUTION_GO = NO (default)**
**OWNER_RLS_DEPLOY_GO = NO (default)**

Do not run these scripts against Staging or Production until Owner issues:

```
OWNER_SQL_GO_WAVE3_PHASE_B=YES
TARGET_ENV=staging|production
```

RLS is a **second** gate (`04_RLS_PACKAGE.md`). Schema apply does not enable RLS.

## Why SQL is required

True durable Tenant → Venue 1:N cannot be stored without schema.

Do **not** treat Staging schema as canonical merely because it already has
`court_clusters.tenant_id`. Production precheck proved a second legitimate
pre-Wave-3 shape.

### Two legitimate pre-migration shapes

Both must converge to the same post-apply state. Architecture is not forked
by environment.

| | Staging (historical) | Production (clean pre-Wave-3) |
|---|---|---|
| `platform_tenants` | absent | absent |
| `venues.tenant_id` | absent | absent |
| `profiles.tenant_id` | absent | absent |
| `court_clusters.venue_id` | present (Phase 23 physical parent) | present (Phase 23 physical parent) |
| `court_clusters.tenant_id` | **present** (Court Ops Batch 8, Staging cutover) | **absent** |

`COURT_CLUSTERS_TENANT_ID_EXISTS=NO` on Production is **EXPECTED_PRE_SCHEMA**.
`02_APPLY` creates the TEXT column; `03_BACKFILL` stamps it from the parent
Venue; `05_VERIFY` proves the post-state. It is **not** resource-data
corruption.

Staging has the column because Court Operations Batch 8
(`docs/v5/migrations/court-operations-legacy-isolation-01/`) added
`court_clusters.tenant_id text NOT NULL` plus indexes, with **no** FK to
`platform_tenants` (that table did not exist). Production never received
Batch 8 / Batch 10. Phase 23 created `court_clusters` with `venue_id` only.

Canonical hierarchy (both environments after Wave 3):

```
Tenant
  ↓
Venue          ← physical parent of Cluster
  ↓
Court Cluster  ← tenant_id is Tenant scope/projection, not physical parent
  ↓
Physical Court
```

Tenant ≠ Venue. Venue ≠ Cluster. Cluster ≠ Physical Court.

## Apply order (when authorized)

1. `01_PRECHECK.sql` (read-only, including slug collision inventory)
2. Snapshot / backup
3. `02_APPLY_platform_tenants_and_venue_fk.sql`
4. `03_BACKFILL.sql` (fails closed on slug collision / profile tenant orphans / cluster tenant drift)
5. `05_VERIFY.sql`
6. **Stop.** Do not run `04_RLS_POLICIES.sql` unless `OWNER_RLS_DEPLOY_GO=YES`

`04_RLS_NOTES.sql` is not executable.

## Slug policy (no silent rename)

- blank/null `venues.slug` → `platform_tenants.slug = venues.id`
- duplicate normalized slugs among venues → **FAIL backfill** (Owner decision)
- derived slug colliding with an existing `platform_tenants` row of a different id → **FAIL**
- existing `platform_tenants` row with the same id → `ON CONFLICT DO NOTHING` (do not overwrite)
- documented but **not** auto-applied alternative: `{slug}--{venue_id}`

If Staging precheck returns duplicate slug groups, stop and return to Owner.

## Backfill strategy

Bootstrap 1:1:

- For each `venues` row, create `platform_tenants` row with `id = venues.id` when missing
- Set `venues.tenant_id = venues.id` where null
- Set `profiles.tenant_id = venues.tenant_id` from home venue; NULL venue stays NULL
- Set `court_clusters.tenant_id = parent venues.tenant_id` where null/blank (never invent Venue from Tenant; never use Cluster id as Tenant)
- Add `profiles.tenant_id → platform_tenants(id)` FK (nullable, `ON DELETE SET NULL`)
- Add `court_clusters.tenant_id` NOT NULL + FK → `platform_tenants(id)` + index `court_clusters_tenant_id_idx`

After backfill, operators may create additional venues under an existing tenant (true 1:N).

## Billing / RLS caution

Today many RLS policies treat `profiles.venue_id` as the billing tenant key (`tenant_subscriptions.tenant_id`).

Phase B **must not** silently break billing:

1. Keep `tenant_subscriptions.tenant_id` meaning **platform tenant id**
2. After backfill, ids continue to match bootstrapped tenant ids (= former venue ids)
3. Subscription policy rewrite is **not** in default apply; see `04_RLS_PACKAGE.md`

## Runtime binding (app)

Canonical after schema+RLS readable:

`public.platform_tenants` → Platform `platformTenantAuthority` → TenantContext / tenantService

`pickleball-tenants-v1` is cache only. Before schema/grants, runtime uses
`COMPATIBILITY_PRE_SCHEMA` and does not claim cloud success.

## Organization

Do **not** create Organization tables or OrganizationContext.

## Production backup gate (independent)

Fixing this package so Production can be migrated does **not** make Production
ready for APPLY.

```
RESOURCE_SCHEMA_PACKAGE_BLOCKER=REMEDIATED
PRODUCTION_BACKUP_GATE=STILL_REQUIRED
RESTORE_READINESS=UNKNOWN
PRODUCTION_SQL_GO=NO
```

Owner must re-run Production PRECHECK and complete the backup gate before any
SQL GO. This package does not create or attest a backup.
