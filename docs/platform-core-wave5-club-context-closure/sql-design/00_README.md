# Wave 5 SQL design — AUTHOR ONLY

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
SQL_EXECUTED=NO
RLS_EXECUTED=NO
```

This folder is a **reviewable design package**. Committing it must not auto-apply to any database. It is **not** a `supabase/migrations` deployment artifact.

Do not apply until Owner issues a separate execution GO naming this package and `TARGET_ENV`.

## Files

| File | Mutates? | Purpose |
|---|---|---|
| `01_PRECHECK.sql` | NO | Read-only fail-closed inventory |
| `02_APPLY_DESIGN.sql` | YES (when GO) | Translate `clubs.tenant_id` Venue→Platform Tenant; Club RPC/RLS |
| `03_VERIFY.sql` | NO | Post-apply read-only invariants |
| `04_ROLLBACK_DESIGN.md` | documentation | App rollback vs DB rollback |

## Durable target

`public.clubs.tenant_id` → `public.platform_tenants(id)` ON DELETE RESTRICT

Algorithm: `clubs.tenant_id` (legacy Venue ID) → `venues.id` → `venues.tenant_id` (canonical Tenant) → `clubs.tenant_id`.

No `clubs.venue_id` column.

## Club RPC

Post-migration `tenant_id` = Platform Tenant ID.

Compatibility fields on `phase42_club_canonical`:

- `scope_semantics = 'canonical_platform_tenant'`
- `canonical_tenant_id = clubs.tenant_id`
- `legacy_venue_scope_id = null`

`club_list_registry` / `clubs` RLS stop using `phase42_is_tenant_member(c.tenant_id)` (Venue-scoped). They use `platform_is_canonical_tenant_entitled(c.tenant_id)` based on `tenant_members` + Super Admin.

**PHASE42_GLOBAL_HELPER_RETIREMENT_INCLUDED=NO** — `phase42_is_tenant_member` is not dropped or globally rewritten.

## Risk: Wave 4 tenant_members FK

Live `tenant_members.tenant_id` may still FK to `venues(id)`. Wave 4 SQL design retargets it to `platform_tenants` but is **not executed**. Current coincidence (`venues.id == platform_tenants.id`) makes entitlement match today. True Tenant 1:N Venue without Wave 4 apply is a known coupling — do not silently repair.
