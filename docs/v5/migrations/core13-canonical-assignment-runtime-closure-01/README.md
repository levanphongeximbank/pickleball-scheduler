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
- is **not** directly executable by browser `authenticated` / `anon` / `PUBLIC`

SQL persistence is **not** a second CORE-13 planner. Direct authenticated RPC
execution is an architectural bypass of ONE DECISION = ONE AUTHORITY.

## Canonical model

| Layer | Owns |
|-------|------|
| **CORE-13 (trusted server)** | Eligibility / validation / replacement / lifecycle **decisions** |
| **Trusted Edge Function** (`competition-referee-assignment`) | Authenticate JWT, canonical tenant/tournament authz, run CORE-13, pass originating actor |
| **Shared command service** (`createCompetitionRefereeAssignmentCommandService`) | Authz + CORE-13 call + CAS command shaping (server bundle) |
| **This SQL package** | Durable persist into `referee_assignments` + audit + idempotency RPCs; service_role-only EXECUTE; tournament-bind + lifecycle defense in depth |
| **Adapter #16 (`competition.audit.adapter.v1`)** | Generic competition audit adapter — **NOT modified** by this package |

Product callers must invoke the Competition assignment Edge Function. The Edge
Function (service-role) then calls `competition_assign_referee` /
`competition_replace_referee` /
`competition_unassign_referee`.

`team_tournament_create_referee_assignment` may remain as **transport compatibility** for
Team Tournament UI paths, but it is **not** Competition assignment business authority.

## Security architecture (trusted server)

Mutation RPCs are **service_role EXECUTE only**.

| Grantee | `competition_assign/replace/unassign_referee` |
|---------|-----------------------------------------------|
| `anon` | DENY |
| `PUBLIC` | DENY |
| `authenticated` | DENY |
| `service_role` | ALLOW |

Why delegated `p_actor_id` is trustworthy:

1. Ordinary browser JWTs cannot EXECUTE the RPC (grant deny).
2. Only the trusted Edge Function holds the service-role key (never in the Vite bundle).
3. The Edge Function authenticates the user JWT on a **user-scoped** client and sets
   `p_actor_id` from `auth.getUser().id` — never from `body.actorId`.
4. `auth.uid()` under service_role is not the originating user (proven conflict with
   JWT tenant/permission helpers). SQL therefore records `p_actor_id` as the durable
   actor and stores server-delegation metadata on the audit payload.
5. Canonical tenant / `tournament.update` / Team manage checks run on the Edge
   Function with the user-scoped client (`canonical_tournament_assert_tenant`,
   `canonical_tournament_assert_permission`, `team_tournament_can_manage`).

SQL defense in depth (not a planner):

- `SERVICE_ROLE_REQUIRED` + `ORIGINATING_ACTOR_REQUIRED`
- tournament-in-tenant bind (`canonical_tournaments` / `team_tournament_resolve_header`)
- lifecycle from `match_live_states` / Team SSOT / Daily Play payload — **never** `p_lifecycle_state`
- Owner hard gates: COMPLETED/LOCKED deny all; IN_PROGRESS new assign deny; IN_PROGRESS unassign deny; SCORING_ACTIVE replace requires `p_emergency_replacement`

Does **not** invent a private RBAC catalog. Does **not** reproduce CORE-13 candidate selection.

**Audit table:** no direct `authenticated` SELECT. Persistence is internal to SECURITY DEFINER RPCs.

**Helpers** (boundary, audit writer, idempotency, scope version) are revoked from `public` / `anon` / `authenticated`.

## Objects (additive)

**Tables**

- `public.competition_referee_assignment_audit` (no client SELECT)
- `public.competition_referee_assignment_idempotency` (no client SELECT)

**RPCs (SECURITY DEFINER · search_path=public · execute → service_role only · revoke public/anon/authenticated)**

- `public.competition_assign_referee(...)`
- `public.competition_replace_referee(...)`
- `public.competition_unassign_referee(...)`

**Internal helper (not client-executable)**

- `public.competition_assignment_assert_mutation_boundary(...)`

**Base table**

- Evolves `public.referee_assignments` additively only (ensure `version` if missing;
  active match+role uniqueness). Never dropped by this package.

## Apply order (Owner GO only — later)

1. `01_PRECHECK.sql` (read-only; fails closed on missing helpers, duplicate active match+role rows, invalid version, incompatible index/function)
2. `02_APPLY.sql` **once**, as **one transaction** (`BEGIN`/`COMMIT`; unique index is not `CONCURRENTLY`)
3. `03_VERIFY.sql` (objects + unique-index predicate + grants + actor + authz + search_path)
4. Staging acceptance harness `scripts/core13/core13-trusted-server-staging-acceptance.mjs`
   **only after** later Owner GO (`CORE13_STAGING_ACCEPTANCE_GO=YES` plus Staging flags).
   `05_STAGING_SQL_ACCEPTANCE.sql` remains a fail-closed pointer.
5. `04_ROLLBACK.sql` emergency only (drops new RPCs/tables if empty; never `referee_assignments`)

## Safety

- `STAGING_ROWS_COPIED=0`
- `EXISTING_BUSINESS_DATA_MUTATION=NO`
- `PERMISSION_CATALOG_DML=NO`
- `ANON_TABLE_WRITE=DENY`
- `ANON_REFEREE_RPC_EXECUTE=DENY`
- `PUBLIC_REFEREE_RPC_EXECUTE=DENY`
- `AUTHENTICATED_REFEREE_RPC_EXECUTE=DENY`
- `SERVICE_ROLE_REFEREE_RPC_EXECUTE=ALLOW`
- `AUDIT_TABLE_DIRECT_AUTHENTICATED_READ=DENY`
- `SQL_EXECUTION_GO=NO` until Owner GO
- `EDGE_FUNCTION_DEPLOY_GO=NO` until Owner GO
- `STAGING_SQL_ACCEPTANCE_TEST_NOT_RUN_REQUIRES_OWNER_GO=YES`
- `APPLY_TRANSACTION_MODEL=SINGLE_EXPLICIT_TRANSACTION`
- `PRECHECK_DUPLICATE_ACTIVE_GUARD=YES` (read-only; no auto-clean)

## Package LF SHA256 lock

Checksums are asserted by `tests/competition-engine-core13-canonical-assignment-runtime-closure-01.test.js`
and must match this table after each authoring change.

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `c2879ba0a4a123c7b328a58bb98d3e16d6ed95a11ef06b6846bb3fd138a8fa25` |
| `02_APPLY.sql` | `3734b9436928c88c8747023bb75fd5be83f6ee006df911c16572640da07419db` |
| `03_VERIFY.sql` | `b4886d61e9b7ec5a4e67afd81f96d50ae4447b30e8857b00026e45df7d401194` |
| `04_ROLLBACK.sql` | `0b33233fcb7d51d4781d4a214c32a68737dd9367d53ae5e014bf42e5e5a73209` |
| `05_STAGING_SQL_ACCEPTANCE.sql` | `661504f517e8bf4cda1988caa551bb56d317247e2628dadcf4dbfcd224cfee48` |

## Related docs

- `docs/competition-engine/core-13/11_CANONICAL_ASSIGNMENT_RUNTIME_CLOSURE.md`
- Sibling style: `docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01/`
