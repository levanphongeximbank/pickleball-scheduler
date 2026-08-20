# Wave 3 Phase B — RLS / security package (review only)

**SQL_EXECUTION_GO = NO**
**OWNER_RLS_DEPLOY_GO = NO (default)**
**Do not silently deploy RLS.**

Schema APPLY (`02_`) and BACKFILL (`03_`) are separate from this package.
`02_APPLY` revokes `anon` / `authenticated` on `public.platform_tenants` and
grants DML only to `service_role`. Browser runtime stays in
`COMPATIBILITY_PRE_SCHEMA` or `SCHEMA_PRESENT_NOT_READABLE` until this package
is authorized.

Execution SQL: `04_RLS_POLICIES.sql`  
This file is the reviewable policy design. `04_RLS_NOTES.sql` is not executable.

## Dual gate

```
OWNER_SQL_GO_WAVE3_PHASE_B=YES
OWNER_RLS_DEPLOY_GO=YES
```

`04_RLS_POLICIES.sql` refuses to run unless:

```sql
SET app.owner_rls_deploy_go = 'YES';
```

## Object: `public.platform_tenants`

| Concern | Decision |
|---|---|
| Grants before RLS | `service_role` only (applied in `02_`) |
| Grants with RLS | `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; **no** `anon` |
| RLS enablement | `ENABLE ROW LEVEL SECURITY` only in this package |
| FORCE RLS | No (service_role / table-owner bypass remains for privileged backend) |
| SELECT | Super Admin: all rows. Tenant-scoped actor: `id = user_tenant_id()` |
| INSERT | Super Admin only |
| UPDATE | Super Admin only in Phase B (tenant-owner self-update deferred) |
| DELETE | Super Admin only |
| Venue access | Venue-scoped actors see the **parent tenant row** via `user_tenant_id()`, never by inventing a venue id from tenant id |
| Service/backend | `service_role` privileged path; no additional SECURITY DEFINER writer in Phase B |

## Helper functions

| Function | Meaning | Invent Venue from Tenant? |
|---|---|---|
| `public.user_tenant_id()` | Actor Tenant scope | No |
| `public.user_home_venue_id()` | Actor home Venue (`profiles.venue_id` only) | **Forbidden** |

Existing `public.user_venue_id()` remains the historical **home venue** helper.
Phase B does not redefine it as Tenant.

## Transitional fallback (named, bounded, removable)

**Name:** `WAVE3_USER_TENANT_ID_VENUE_FALLBACK`

```
user_tenant_id() = COALESCE(NULLIF(profiles.tenant_id,''), NULLIF(profiles.venue_id,''))
```

**Why:** After 1:1 bootstrap, `profiles.venue_id` still equals the bootstrapped
tenant id for existing venue-assigned users. Billing (`tenant_subscriptions.tenant_id`)
continues to match those ids.

**Bound:** Fallback is only the Tenant helper. `user_home_venue_id()` must never
`COALESCE` to `profiles.tenant_id`.

**Removal condition:**

1. `profiles` with non-null `venue_id` all have non-null `tenant_id`
2. No remaining policy compares `tenant_subscriptions.tenant_id` to `profiles.venue_id`
3. Owner sets `OWNER_RETIRE_USER_TENANT_VENUE_FALLBACK=YES`

## Super Admin

`public.is_super_admin()` continues to bypass tenant row filters.
Super Admin / platform-scoped profiles may keep `profiles.tenant_id IS NULL`.

## Normal Tenant-scoped behavior

Authenticated non-SA users SELECT only `platform_tenants.id = user_tenant_id()`.
They cannot INSERT/UPDATE/DELETE tenant identity in Phase B.

## Venue access behavior

- Home venue remains `profiles.venue_id` / `user_home_venue_id()`.
- A venue-scoped user sees the parent Tenant row because `user_tenant_id()`
  resolves Tenant, not because Tenant id is treated as a Venue id.
- Venue RLS is **not** rewritten in this package. Existing
  `venues_owner_select` (`id = user_venue_id() OR owner_id = auth.uid()`)
  continues until a later Owner-authorized Venue RLS workstream.
- After backfill, `venues.tenant_id` is the parent. Future venue SELECT should
  be `tenant_id = user_tenant_id() OR id = user_home_venue_id() OR is_super_admin()`
  — documented, not auto-applied here.

## `tenant_subscriptions` continuity

Today:

```
tenant_id = (select p.venue_id from public.profiles p where p.id = auth.uid())
```

After 1:1 bootstrap those values still match `platform_tenants.id`.
**This package does not rewrite `tenant_subscriptions` policies.**

Optional later rewrite (separate Owner GO
`OWNER_RLS_REWRITE_SUBSCRIPTION_POLICIES=YES`):

```
tenant_id = public.user_tenant_id() OR public.is_super_admin()
```

Until then, billing continues to key off the historical venue-id-shaped tenant
id. That is continuity, not a second Tenant authority.

## `profiles` tenant authorization

- `profiles.tenant_id` is nullable (Super Admin / platform users).
- FK `profiles.tenant_id → platform_tenants(id) ON DELETE SET NULL` is created
  in `03_BACKFILL.sql`, not here.
- Phase B does not add new profiles RLS. Existing `profiles_self_select` /
  staff SELECT remain.
- Actors authorize Tenant via `user_tenant_id()`; they do not gain foreign
  Tenant rows.

## What this package will not do

- Will not drop `public.tenants`
- Will not invent Venue identity from Tenant identity
- Will not enable RLS inside `02_APPLY` / `03_BACKFILL`
- Will not grant `anon`
- Will not make Competition Platform an authority
