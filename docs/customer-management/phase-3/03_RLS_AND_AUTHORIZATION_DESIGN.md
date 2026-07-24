# 03 — RLS And Authorization Design

## Verified helpers only

- `auth.uid()`
- `public.user_venue_id()`
- `public.user_has_permission(text)`
- `public.is_super_admin()`

Module helper: `public.customer_phase3_scope_allows(tenant_id, venue_id)`.

## Sprint-2 identity constraint

Verified JWT binding is `profiles.venue_id` via `user_venue_id()`.  
No verified distinct `user_tenant_id()` exists. Policies therefore require:

```
venue_id = user_venue_id()
AND tenant_id = user_venue_id()
```

Rows with `tenant_id <> venue_id` are inaccessible via JWT until Identity publishes a real tenant helper — fail-closed.

## Policies (CUSTOMER-03)

| Table | authenticated | anon | service_role |
|-------|---------------|------|--------------|
| customers | SELECT (+ scope + permission/super_admin) | none | bypasses RLS (Supabase) |
| customer_contact_points | SELECT (+ scope + parent EXISTS) | none | bypasses RLS |
| customer_addresses | SELECT (+ scope + parent EXISTS) | none | bypasses RLS |

**No authenticated INSERT/UPDATE/DELETE policies.** Client writes are blocked until Owner authorizes permission seed + write policies.

Permission keys referenced (not seeded in CUSTOMER-03): `customer.view`, `customer.edit`.

## Authorization assumptions

- Durable adapter runs on trusted server/service-role path.
- App must not enable Customer durable runtime where authorization boundary is missing.
- No anonymous access. No `USING (true)`.
