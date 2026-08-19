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
| `01_PRECHECK.sql` | NO | Read-only fail-closed inventory for every in-scope Club table + Wave 4 `tenant_members` FK |
| `02_APPLY_DESIGN.sql` | YES (when GO) | Strongly state-guarded Venue→Platform Tenant cutover for Club-owned tables + Club RPC/RLS |
| `03_VERIFY.sql` | NO | Post-apply read-only invariants |
| `04_ROLLBACK_DESIGN.md` | documentation | App rollback vs DB rollback |
| `05_CLUB_TENANT_TABLE_INVENTORY.md` | documentation | Tenant-bearing table classification |
| `06_CLUB_MUTATION_RPC_INVENTORY.md` | documentation | Club mutation RPC semantics |

## Schema-state machine

| State | Condition | Allowed |
|---|---|---|
| `STATE_LEGACY` | `clubs` + `club_members` + `club_governance_assignments` + `club_membership_requests_v42` `tenant_id` FK **exactly** `public.venues(id)` | materialize map, validate, translate, replace FK |
| `STATE_CANONICAL` | all four FKs **exactly** `public.platform_tenants(id)` | DO NOT translate data, DO NOT join values to `venues.id` as migration source, only rerunnable function/policy reconcile |
| `STATE_UNKNOWN` | anything else, including mixed FKs | hard abort |

The DATA `UPDATE` is inside the `STATE_LEGACY` branch of the **same** `DO` block. A prior local `RETURN` cannot leak into an unconditional rewrite.

`CANONICAL_STATE_CANNOT_EXECUTE_LEGACY_TRANSLATION=YES`

Do not use `venues.id = platform_tenants.id` as a migration predicate.

## Durable target

Club-owned `tenant_id` → `public.platform_tenants(id)` ON DELETE RESTRICT:

- `public.clubs`
- `public.club_members`
- `public.club_governance_assignments`
- `public.club_membership_requests_v42`

Algorithm when `STATE_LEGACY`: old `tenant_id` (Venue ID) → `venues.id` → `venues.tenant_id` → Platform Tenant ID. Child rows follow parent `club_id` mapping. Cross-table Club/Tenant disagreement aborts.

No `clubs.venue_id` column.

Athletes / idempotency / audit are **not** migrated. Club RPCs that ensure athletes use `wave5_ensure_athlete_for_club_member` (facility Venue from registered cluster), never Club Tenant as `venues.id`.

## Club RPC

Post-migration `p_tenant_id` / Club-owned row `tenant_id` = Platform Tenant ID.

`club_create` existence check is `public.platform_tenants(id)`. Authorization is `phase42_can_create_in_tenant` (tenant_members + Super Admin + PLAYER/CLUB_MANAGER `club.create`). Registered cluster is validated independently through Venue/Cluster topology and must not redefine Club tenant identity.

`club_list_registry` / Club SELECT RLS / `club_list_members` use `platform_is_canonical_tenant_entitled` (`tenant_members` + Super Admin). Club authz helpers drop `profiles.venue_id = c.tenant_id`.

**PHASE42_GLOBAL_HELPER_RETIREMENT_INCLUDED=NO** — `phase42_is_tenant_member` is not dropped or globally rewritten.

## Wave 4 tenant_members (CLOSED — do not re-execute)

**TENANT_MEMBERS_WAVE4_CANONICAL_FK_EXPECTED=YES**

**WAVE4_SQL_REEXECUTION_REQUIRED=NO**

Wave 4 Production/Staging closed state already applied:

`tenant_members.tenant_id` → `public.platform_tenants(id)` ON DELETE RESTRICT

Wave 5 precheck **expects** that canonical FK and fails closed if the target environment unexpectedly differs. Do not rewrite Wave 4 migrations. Do not re-execute Wave 4 SQL.
