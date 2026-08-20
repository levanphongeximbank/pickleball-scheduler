# Wave 4 Staging remediation rollback — DO NOT EXECUTE

Rollback is **manual** and requires a separate Owner GO. There is **no** automatic rollback script in this package, because a silent restore of Venue-as-Tenant SELECT would reintroduce known authorization debt.

## Distinguish three layers

### 1. FK rollback

If `02_APPLY_TENANT_MEMBERS_TENANT_FK.sql` was applied:

1. Confirm every `tenant_members.tenant_id` still exists in `public.venues` **if** you intend to restore the legacy FK. If any row is missing from `venues`, **stop**. Do not invent Venue IDs.
2. Introspect the live `tenant_id` FK. Drop **only** the constraint whose definition is `FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id)`.
3. Recreate the previous venues FK only after that introspection:

```sql
-- EXAMPLE ONLY — do not run as a blind package.
-- ALTER TABLE public.tenant_members
--   ADD CONSTRAINT tenant_members_tenant_id_fkey
--   FOREIGN KEY (tenant_id) REFERENCES public.venues(id) ON DELETE CASCADE;
```

Do not drop unrelated constraints. Do not `DROP CONSTRAINT IF EXISTS` against a name without checking `pg_get_constraintdef`.

FK rollback does **not** restore Venue-as-Tenant authorization. It only restores the historical FK target.

### 2. RLS policy rollback

If `03_APPLY_TENANT_MEMBERS_RLS_AND_GRANTS.sql` was applied:

Restoring the previous SELECT policy:

```
phase42_is_platform_super_admin()
OR user_id = auth.uid()
OR phase42_is_tenant_member(tenant_id)
```

**reintroduces:**

- Venue-as-Tenant fallback inside `phase42_is_tenant_member`
- foreign membership reads for any actor that helper treats as a tenant member

That is known legacy authorization debt. Do **not** roll back RLS merely to restore operator convenience.

Preferred stay-forward: keep canonical self + Super Admin SELECT. If Tenant Owners need a co-member directory, add a **server/RPC** capability later (`TENANT_MEMBER_DIRECTORY_SERVER_CAPABILITY_GAP=YES`). Do not widen direct-table policy.

### 3. Privilege rollback

If TRUNCATE was revoked from `anon` / `authenticated`, **do not** re-grant TRUNCATE to those roles as a rollback step.

TRUNCATE on `tenant_members` for `anon`/`authenticated` is a defect, not a compatibility feature.

## What this package must not do on rollback

- No script that silently widens SELECT
- No FORCE RLS toggle
- No `user_tenant_id()` rewrite
- No global `phase42_is_tenant_member` replacement
- No membership INSERT/DELETE as “rollback”
- No Production apply
