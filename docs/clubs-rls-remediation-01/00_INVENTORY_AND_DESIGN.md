# CLUBS-RLS-REMEDIATION-01 — Inventory & Design

**Blocker:** B-CLUBS-RLS-01 — HIGH
**Parent:** PLATFORM-FINAL-AUDIT-01
**Baseline:** `adc43eb3979292a09687cf099404235583f7895e`

## Canonical policy owner

| Item | Owner |
|------|-------|
| Table DDL `public.clubs` | `docs/v5/PHASE_42B_SCHEMA.sql` |
| RLS enable + `clubs_select` | `docs/v5/PHASE_42C_RLS_RPC.sql` (**canonical**) |
| Staging-first patch | `docs/clubs-rls-remediation-01/sql/10_CLUBS_RLS_REMEDIATION_01_FORWARD.sql` |
| Public discovery RPC | `docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql` |

No other SQL file in-repo recreates `clubs_select`. Writer policies on `public.clubs` do not exist; Phase 42C revokes INSERT/UPDATE/DELETE from `authenticated`/`anon`.

## Defect (current / Production evidence)

```sql
-- historical clubs_select USING (authenticated):
deleted_at is null
and (
  phase42_is_platform_super_admin()
  or phase42_is_tenant_member(tenant_id)
  or status = 'active'          -- ← BROAD CROSS-TENANT FULL-ROW READ
  or exists (active club_members for auth.uid())
)
```

Any authenticated user could `SELECT *` every non-deleted active club row (all columns), including `tenant_id`, `registered_cluster_id`, `created_by_user_id`.

## Target policy

```sql
deleted_at is null
and (
  phase42_is_platform_super_admin()
  or phase42_is_tenant_member(tenant_id)
  or phase42_active_club_member_id(id) is not null  -- SECURITY DEFINER; avoids club_members RLS recursion
)
```

**Recursion note:** A direct `EXISTS (SELECT … FROM club_members …)` inside `clubs_select` re-enters `club_members_select` (self-referential EXISTS) and raises `infinite recursion detected in policy for relation "club_members"`. Use `phase42_active_club_member_id` instead. The historical broad `OR status = 'active'` masked this by short-circuiting before the EXISTS path for active clubs.

Public directory remains `public.public_catalog_list_clubs` (SECURITY DEFINER, allowlisted columns, filters `is_publicly_listed`, `status='active'`, `deleted_at is null`).

## Competing policy analysis

| Policy | Command | Roles | Conflict? |
|--------|---------|-------|-----------|
| `clubs_select` | SELECT | authenticated | Sole SELECT policy — remediation replaces it |
| (none) | INSERT/UPDATE/DELETE | — | No writer policies; grants revoked |

**N10:** After forward, exactly one SELECT policy; no second permissive policy reintroduces broad read.

## Consumer inventory

| Consumer | Path | Direct table SELECT? | Impact of remediation |
|----------|------|----------------------|----------------------|
| Club registry list | `club_list_registry` (SECURITY DEFINER) | No (RPC) | None — own authz |
| Discover clubs | `club_list_discoverable` (SECURITY DEFINER) | No (RPC) | None |
| Club get | `club_get` / `phase42_club_canonical` | No (RPC) | None |
| Governance / membership RPCs | Phase 45 / 1B / 1C / 2D | No (RPC) | None |
| Public Portal / catalog | `public_catalog_list_clubs` | No (RPC) | None — kept |
| App PostgREST `.from('clubs')` | — | **None found** | No app dependency on broad authenticated full-row discovery |

## Writer impact

None. Forward reaffirms `REVOKE INSERT, UPDATE, DELETE` and does not create writer policies (N8).

## Inactive / deleted contract (N9)

- Soft-deleted (`deleted_at IS NOT NULL`): still hidden by outer gate for all RLS paths.
- Inactive (`status <> 'active'`, not deleted): previously only visible via SA / tenant member / club member (broad branch did not help). Unchanged for those actors.

## Migration / rollback convention

Matches security-gate style under `docs/` (not `supabase/migrations/` — repo has no migration runner folder):

- `00_` preflight (read-only)
- `10_` forward
- `20_` post-apply verify
- `90_` rollback
- Runbooks separate; Production draft only

## Source-of-truth update

`docs/v5/PHASE_42C_RLS_RPC.sql` updated to match forward policy so fresh Phase 42C applies do not reintroduce the broad branch.
