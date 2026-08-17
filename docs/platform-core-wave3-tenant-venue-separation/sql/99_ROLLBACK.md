# Rollback guidance — Wave 3 Phase B

**Prefer restore from backup** taken before APPLY.

If only columns were added and backfilled:

1. Drop FK `venues_tenant_id_fkey` if present
2. Optionally drop columns `venues.tenant_id`, `profiles.tenant_id` (destructive to Wave 3 app expectations)
3. Drop table `public.platform_tenants`
4. Drop helpers `user_tenant_id()`, `user_home_venue_id()` if created

Do **not** drop the legacy `public.tenants` view until a separate cutover workstream replaces all readers.

App Phase A remains functional with local bridge (`tenantId = venue.id` on unmigrated rows) even if SQL is not applied.
