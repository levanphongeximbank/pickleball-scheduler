# CORE-13 — Canonical Assignment Runtime Closure

**Status:** SQL authored + security-hardened · **not executed** (`SQL_DESIGN_AND_MIGRATION_AUTHORING_GO=YES`, `SQL_EXECUTION_GO=NO`)  
**Package:** `docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/`  
**Date:** 2026-08-17

---

## Ownership

| Concern | Owner |
|---------|-------|
| Assignment **decisions** (eligibility, validation, replace policy, lifecycle gate shapes) | **CORE-13** |
| Shared command orchestration (authz → CORE-13 → CAS command → persist) | Competition Operations (`createCompetitionRefereeAssignmentCommandService`) |
| Durable assignment rows | `public.referee_assignments` (additive reuse; no parallel table) |
| Durable Competition assignment **audit** + **idempotency** | This package (`competition_referee_assignment_*`) |
| Generic competition audit adapter | **Adapter #16** (`competition.audit.adapter.v1`) — **NOT modified** |
| Staging/Production apply | Owner GO only (refused without GO) |

CORE-13 remains decision authority. Persistence RPCs execute validated commands only; they do not become a second business authority.

SQL mutation RPCs independently assert existing canonical tenant/permission authorities (`canonical_tournament_assert_tenant`, `canonical_tournament_assert_permission('tournament.update')`, Team bind via `team_tournament_resolve_header` / `team_tournament_can_manage`). Direct RPC callers cannot bypass that boundary via the JS command layer. Actor provenance is `auth.uid()` only. Assignment audit is not directly readable by `authenticated`.

---

## Runtime closure

Product callers must use:

1. Shared Competition assignment command service, and/or
2. SECURITY DEFINER RPCs:
   - `competition_assign_referee`
   - `competition_replace_referee` (atomic revoke + insert)
   - `competition_unassign_referee` (status=`revoked`; history retained)

`team_tournament_create_referee_assignment` may remain as Team Tournament **transport compatibility**, but must **not** remain Competition assignment business authority.

---

## SQL package contents

| File | Role |
|------|------|
| `01_PRECHECK.sql` | Refuse if `referee_assignments` **or** canonical tenant/permission helpers missing |
| `02_APPLY.sql` | Audit + idempotency tables; competition_* RPCs; SQL authz boundary; additive index/version |
| `03_VERIFY.sql` | Objects + grants + RLS + actor spoofing + search_path + CAS/idempotency |
| `04_ROLLBACK.sql` | Drop new RPCs/tables if empty; **never** drop `referee_assignments` |
| `05_STAGING_SQL_ACCEPTANCE.sql` | Later Owner GO only; currently fails closed |

Constraints honored: additive evolution, no business DML, no Staging row copy, LOCAL PACKAGE ONLY headers.

---

## Adapter #16 boundary

Adapter #16 is the locked generic audit contract (`appendAuditRecord` / `queryAuditEvidence`).  
This closure adds **Competition-owned durable assignment audit tables** for CORE-13 runtime evidence. It does **not** change Adapter #16 contracts, bindings, or forbidden methods.

---

## Execution gate

Do **not** apply to Staging or Production until Owner GO. Authoring this package does not imply runtime enablement.
