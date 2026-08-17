# Rollback guidance — Wave 3 Phase B

**Prefer restore from backup** taken before APPLY.

If only columns were added and backfilled:

1. Drop FK `profiles_tenant_id_fkey` if present
2. Drop FK `venues_tenant_id_fkey` if present
3. Optionally drop columns `venues.tenant_id`, `profiles.tenant_id` (destructive to Wave 3 app expectations)
4. Drop table `public.platform_tenants`
5. Drop helpers `user_tenant_id()`, `user_home_venue_id()` only if the RLS package was applied

Do **not** drop the legacy `public.tenants` view until cutover conditions in
`../LEGACY_PUBLIC_TENANTS_CUTOVER.md` are met and Owner authorizes
`OWNER_DROP_PUBLIC_TENANTS_VIEW=YES`.

App remains functional in `COMPATIBILITY_PRE_SCHEMA` (local cache + explicit
1:1 venue bridge) if SQL is rolled back. That mode is not cloud Tenant authority.
