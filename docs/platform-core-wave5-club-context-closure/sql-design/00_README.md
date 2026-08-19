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

## Round 2 remediation (pending Round 3 Owner SQL review)

```
SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW
ROUND2_BLOCKER_01=REMEDIATED
ROUND2_BLOCKER_02=REMEDIATED
DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
POST_MAP_NAME_COLLISION_GUARD=YES
POST_MAP_CODE_COLLISION_GUARD=YES
SQL_DESIGN_REVIEWED_PASS=NO
```

**ATHLETE_NO_CLUSTER_POLICY=reuse existing athlete if any (Participant user_id uniqueness; Venue not required for reuse); else require Club.registered_cluster_id → court_clusters.venue_id → venues.id; else fail closed ATHLETE_FACILITY_VENUE_REQUIRED. No Tenant-as-Venue, no first/default Venue, no clubs.venue_id, no profiles.venue_id from the Wave 5 wrapper.**

`athletes.tenant_id` remains facility/Venue-scoped. Wave 5 does not migrate `athletes` onto `platform_tenants`.

PRECHECK uses `to_regprocedure` exact signatures (not `proname LIMIT 1`). `STATE_CANONICAL` uniqueness is checked on Club `tenant_id` without treating it as Venue. `STATE_LEGACY` uniqueness is checked on `venues.tenant_id` after conceptual translation. Collision classification: `DATA_RECONCILIATION_OWNER_DECISION_REQUIRED`.
