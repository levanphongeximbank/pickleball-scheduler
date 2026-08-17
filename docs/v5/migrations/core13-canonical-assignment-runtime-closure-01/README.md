# core13-canonical-assignment-runtime-closure-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**SQL_DESIGN_AND_MIGRATION_AUTHORING_GO=YES · SQL_EXECUTION_GO=NO** — authored only; not executed.

**Forward-only.** NEVER re-run prior packages. Additive. No business DML. No Staging row copy.

## Why

CORE-13 owns assignment **decisions**. Competition needs a durable **runtime closure** for
assign / replace / unassign that:

- reuses `public.referee_assignments` (no parallel assignment table)
- enforces CAS (`expected_version`) + idempotency
- records Competition-owned durable audit evidence
- keeps replace **atomic** (revoke old + insert new in one RPC transaction)
- **independently asserts** tenant/tournament/actor/lifecycle on the SQL boundary
  so a direct RPC caller cannot bypass the JS shared command

## Canonical model

| Layer | Owns |
|-------|------|
| **CORE-13** | Eligibility / validation / replacement / lifecycle **decisions** |
| **Shared command service** (`createCompetitionRefereeAssignmentCommandService`) | Authz + CORE-13 call + CAS command shaping |
| **This SQL package** | Durable persist into `referee_assignments` + audit + idempotency RPCs; **fail-closed SQL authz** |
| **Adapter #16 (`competition.audit.adapter.v1`)** | Generic competition audit adapter — **NOT modified** by this package |

Product callers must use `competition_assign_referee` /
`competition_replace_referee` /
`competition_unassign_referee` (via the shared command service).

`team_tournament_create_referee_assignment` may remain as **transport compatibility** for
Team Tournament UI paths, but it is **not** Competition assignment business authority.

## Security architecture (Option A)

Authenticated clients may EXECUTE the three mutation RPCs. That is safe only because
each RPC calls internal `competition_assignment_assert_mutation_boundary`, which:

1. Requires `auth.uid()`
2. Rejects `p_actor_id` when it is distinct from `auth.uid()` (`ACTOR_SPOOFING_DENIED`)
3. Calls existing `canonical_tournament_assert_tenant(p_tenant_id)` (`user_venue_id()` / `is_super_admin()`)
4. Binds `p_tournament_id` to `canonical_tournaments` (tenant-scoped id or `external_key`) and/or `team_tournament_resolve_header`; unbound → `CROSS_TOURNAMENT_DENIED`
5. Asserts existing `canonical_tournament_assert_permission('tournament.update')` or, when a Team header is bound, `team_tournament_can_manage()`
6. Derives lifecycle from `match_live_states` / Team match SSOT / Daily Play payload / tournament status — **never trusts `p_lifecycle_state`**
7. Enforces Owner hard gates: COMPLETED/LOCKED deny all; IN_PROGRESS new assign deny; IN_PROGRESS unassign deny; SCORING_ACTIVE replace requires `p_emergency_replacement`

Does **not** invent a private RBAC catalog. Does **not** reproduce CORE-13 candidate selection.

**Audit table:** no direct `authenticated` SELECT. Persistence is internal to SECURITY DEFINER RPCs.

**Helpers** (boundary, audit writer, idempotency, scope version) are revoked from `public` / `anon` / `authenticated`.

## Objects (additive)

**Tables**

- `public.competition_referee_assignment_audit` (no client SELECT)
- `public.competition_referee_assignment_idempotency` (no client SELECT)

**RPCs (SECURITY DEFINER · search_path=public · execute → authenticated + service_role · revoke public/anon)**

- `public.competition_assign_referee(...)`
- `public.competition_replace_referee(...)`
- `public.competition_unassign_referee(...)`

**Internal helper (not client-executable)**

- `public.competition_assignment_assert_mutation_boundary(...)`

**Base table**

- Evolves `public.referee_assignments` additively only (ensure `version` if missing;
  active match+role uniqueness). Never dropped by this package.

## Apply order (Owner GO only — later)

1. `01_PRECHECK.sql` (fails closed if canonical tenant/permission helpers missing)
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql` (objects + grants + actor + authz + search_path)
4. `05_STAGING_SQL_ACCEPTANCE.sql` **only after** later Owner GO (currently refuses)
5. `04_ROLLBACK.sql` emergency only (drops new RPCs/tables if empty; never `referee_assignments`)

## Safety

- `STAGING_ROWS_COPIED=0`
- `EXISTING_BUSINESS_DATA_MUTATION=NO`
- `PERMISSION_CATALOG_DML=NO`
- `ANON_TABLE_WRITE=DENY`
- `ANON_REFEREE_RPC_EXECUTE=DENY`
- `PUBLIC_REFEREE_RPC_EXECUTE=DENY`
- `AUDIT_TABLE_DIRECT_AUTHENTICATED_READ=DENY`
- `SQL_EXECUTION_GO=NO` until Owner GO
- `STAGING_SQL_ACCEPTANCE_TEST_NOT_RUN_REQUIRES_OWNER_GO=YES`

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `1faa3140ab5b97c0e5e40b3c0425eb67d7d796639db55f286c8716271e66b7e5` |
| `02_APPLY.sql` | `a4d534c540aed036969e6dd696aab52d122b8fad1344b44fda79500b7015b87f` |
| `03_VERIFY.sql` | `fc93c49fa779c1ec5424923503656ee4d1c87aa4e65ad4f04f41fbf9fe795bdf` |
| `04_ROLLBACK.sql` | `6a6274ebbfc8e64456a8079e77871404d78c9bf1bb3f9652e808c52bdf76c1af` |
| `05_STAGING_SQL_ACCEPTANCE.sql` | `99464f540ae349407d99274114d03b98eb19f4d152881b84b5a7a6add40abc4f` |

## Related docs

- `docs/competition-engine/core-13/11_CANONICAL_ASSIGNMENT_RUNTIME_CLOSURE.md`
- Sibling style: `docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01/`
