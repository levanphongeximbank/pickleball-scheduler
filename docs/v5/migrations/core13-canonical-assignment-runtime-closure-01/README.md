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

## Canonical model

| Layer | Owns |
|-------|------|
| **CORE-13** | Eligibility / validation / replacement / lifecycle **decisions** |
| **Shared command service** (`createCompetitionRefereeAssignmentCommandService`) | Authz + CORE-13 call + CAS command shaping |
| **This SQL package** | Durable persist into `referee_assignments` + audit + idempotency RPCs |
| **Adapter #16 (`competition.audit.adapter.v1`)** | Generic competition audit adapter — **NOT modified** by this package |

Product callers must use `competition_assign_referee` /
`competition_replace_referee` /
`competition_unassign_referee` (via the shared command service).

`team_tournament_create_referee_assignment` may remain as **transport compatibility** for
Team Tournament UI paths, but it is **not** Competition assignment business authority.

## Objects (additive)

**Tables**

- `public.competition_referee_assignment_audit`
- `public.competition_referee_assignment_idempotency`

**RPCs (SECURITY DEFINER · execute → authenticated · revoke public/anon)**

- `public.competition_assign_referee(...)`
- `public.competition_replace_referee(...)`
- `public.competition_unassign_referee(...)`

**Base table**

- Evolves `public.referee_assignments` additively only (ensure `version` if missing;
  active match+role uniqueness). Never dropped by this package.

## Apply order (Owner GO only — later)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql`
4. `04_ROLLBACK.sql` emergency only (drops new RPCs/tables if empty; never `referee_assignments`)

## Safety

- `STAGING_ROWS_COPIED=0`
- `EXISTING_BUSINESS_DATA_MUTATION=NO`
- `PERMISSION_CATALOG_DML=NO`
- `ANON_TABLE_WRITE=DENY`
- `ANON_REFEREE_RPC_EXECUTE=DENY`
- `SQL_EXECUTION_GO=NO` until Owner GO

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `eb6be821e0fb6a6010b71366e5c1afdbd015548013d3ccd9b3e4edab42cb8bce` |
| `02_APPLY.sql` | `9e861ab42877df81ce3475d582451bf83669afd0323dd307d7d9db46dad5732a` |
| `03_VERIFY.sql` | `4bc4580ef846e59badf3b9a8434937b80812f5ec1a13a0ecbe5b6b1404cfe202` |
| `04_ROLLBACK.sql` | `e3e5e333c0486e7ce0b583d3a88faaa4e14645b154301c938421d8c28805976c` |

## Related docs

- `docs/competition-engine/core-13/11_CANONICAL_ASSIGNMENT_RUNTIME_CLOSURE.md`
- Sibling style: `docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01/`
