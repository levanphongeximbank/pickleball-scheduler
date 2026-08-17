# Rollback guidance — Wave 3 Phase B

**Prefer restore from a Production backup** taken before APPLY.
Do not execute this document. Manual rollback is more dangerous than restore.

Venue remains the physical parent of Court Cluster in every rollback path.
Do not invent a Venue from `tenant_id`. Do not treat Cluster tenant scope as
the physical-parent authority.

## Wave 3-owned Cluster tenant objects

`03_BACKFILL` adds:

- FK `court_clusters_tenant_id_fkey` → `public.platform_tenants(id)`
- index `court_clusters_tenant_id_idx` (idempotent; same name as Court Ops Batch 8)

`02_APPLY` adds `court_clusters.tenant_id text` only when the column is absent.

### If Cluster tenant FK / index were added

1. Drop FK `court_clusters_tenant_id_fkey` if present
2. Drop index `court_clusters_tenant_id_idx` **only** when a full Wave 3
   database rollback is intentionally authorized **and** the environment did
   not already have that index from Court Ops Batch 8
   - Production: Wave 3 created the index → drop is part of full Wave 3 rollback
   - Staging: Batch 8 already created the index → do **not** drop it as a
     Wave-3-only rollback; dropping it is a Court Ops Batch 8 rollback

### `court_clusters.tenant_id` column removal

Remove `court_clusters.tenant_id` **only** when a full Wave 3 database
rollback is intentionally authorized **and** Wave 3 created the column.

- Production: column was absent before Wave 3 → drop is part of full Wave 3 rollback
- Staging: column pre-existed (Batch 8) → do **not** drop it as a Wave-3-only
  rollback. Dropping Staging `court_clusters.tenant_id` is Court Ops Batch 8
  rollback, not Wave 3 schema undo.

## Other Wave 3 objects

If only columns were added and backfilled (full Wave 3 rollback, after backup
restore is declined by Owner):

1. Drop FK `court_clusters_tenant_id_fkey` if present
2. Drop FK `profiles_tenant_id_fkey` if present
3. Drop FK `venues_tenant_id_fkey` if present
4. Optionally drop columns `venues.tenant_id`, `profiles.tenant_id`
   (destructive to Wave 3 app expectations)
5. Optionally drop `court_clusters.tenant_id` **only** under the Production /
   Wave-3-created-column rule above
6. Drop table `public.platform_tenants`
7. Drop helpers `user_tenant_id()`, `user_home_venue_id()` only if the RLS
   package was applied

Do **not** drop the legacy `public.tenants` view until cutover conditions in
`../LEGACY_PUBLIC_TENANTS_CUTOVER.md` are met and Owner authorizes
`OWNER_DROP_PUBLIC_TENANTS_VIEW=YES`.

App remains functional in `COMPATIBILITY_PRE_SCHEMA` (local cache + explicit
1:1 venue bridge) if SQL is rolled back. That mode is not cloud Tenant authority.
