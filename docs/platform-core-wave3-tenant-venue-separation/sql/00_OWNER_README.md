# Owner SQL package — Wave 3 Phase B

**SQL_EXECUTION_GO = NO (default)**

Do not run these scripts against Staging or Production until Owner issues:

```
OWNER_SQL_GO_WAVE3_PHASE_B=YES
TARGET_ENV=staging|production
```

## Why SQL is required

Staging evidence (read-only list_tables / column inventory):

- `public.tenants` is a **VIEW** over venues (not a real tenant table)
- `public.venues` has **no** `tenant_id` column
- `public.profiles` has `venue_id` but **no** `tenant_id`
- `public.court_clusters` already has both `venue_id` and `tenant_id` (good)
- `public.clubs` has `tenant_id` (club is tenant-scoped)

True durable Tenant → Venue 1:N cannot be stored without schema.

## Apply order (when authorized)

1. `01_PRECHECK.sql` (read-only)
2. Snapshot / backup
3. `02_APPLY_platform_tenants_and_venue_fk.sql`
4. `03_BACKFILL.sql`
5. Review `04_RLS_NOTES.sql` and adapt policies carefully (billing still keys many checks on venue id)
6. `05_VERIFY.sql`

## Backfill strategy

Bootstrap 1:1:

- For each `venues` row, create `platform_tenants` row with `id = venues.id`
- Set `venues.tenant_id = venues.id`
- Set `profiles.tenant_id = profiles.venue_id` where venue_id present

After backfill, operators may create additional venues under an existing tenant (true 1:N).

## Billing / RLS caution

Today many RLS policies treat `profiles.venue_id` as the billing tenant key (`tenant_subscriptions.tenant_id`).

Phase B **must not** silently break billing. Recommended approach:

1. Keep `tenant_subscriptions.tenant_id` meaning **platform tenant id**
2. After backfill, `tenant_subscriptions.tenant_id` continues to match bootstrapped tenant ids (= former venue ids)
3. Gradually migrate policies that incorrectly compare venue facility identity to tenant identity

## Organization

Do **not** create Organization tables or OrganizationContext.
