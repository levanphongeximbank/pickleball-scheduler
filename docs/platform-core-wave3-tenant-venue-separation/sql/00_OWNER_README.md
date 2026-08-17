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

Staging evidence (read-only list_tables / column inventory):

- `public.tenants` is a **VIEW** over venues (not a real tenant table)
- `public.venues` has **no** `tenant_id` column
- `public.profiles` has `venue_id` but **no** `tenant_id`
- `public.court_clusters` already has both `venue_id` and `tenant_id` (good)
- `public.clubs` has `tenant_id` (club is tenant-scoped)

True durable Tenant → Venue 1:N cannot be stored without schema.

## Apply order (when authorized)

1. `01_PRECHECK.sql` (read-only, including slug collision inventory)
2. Snapshot / backup
3. `02_APPLY_platform_tenants_and_venue_fk.sql`
4. `03_BACKFILL.sql` (fails closed on slug collision / profile tenant orphans)
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
- Add `profiles.tenant_id → platform_tenants(id)` FK (nullable, `ON DELETE SET NULL`)

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
