# CORE-03 Phase 1G — Staging Rollout Checklist (Gated)

**Purpose:** Future Staging-first apply gate for Phase 1F persistence SQL.
**Current phase action:** Document only. **Do not perform any step that connects to a database.**

Owner decisions remain:

- `TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED`
- `CORE02_ENTRY_CREATION = DEFERRED_FAIL_CLOSED`
- `MIGRATION_STATUS = AUTHORED_NOT_APPLIED`
- No Production mutation from this checklist until a separate Production GO

Artifacts:

- Apply SQL: `docs/competition-engine/core-03/supabase-core03-phase1f-persistence.sql`
- Rollback SQL: `docs/competition-engine/core-03/supabase-core03-phase1f-persistence-rollback.sql`
- Verification queries: `docs/competition-engine/core-03/09_MIGRATION_VERIFICATION_QUERIES.md`

---

## Gated checklist

| # | Gate | Required evidence | Status in Phase 1G |
|---|------|-------------------|--------------------|
| 1 | Owner GO | Written Owner approval for Staging apply | NOT PERFORMED |
| 2 | Approved backup or restore point | Backup ID / restore point timestamp | NOT PERFORMED |
| 3 | Approved Staging credentials | Credential holder + scope (Staging only) | NOT PERFORMED |
| 4 | Environment identity confirmation | Project URL / ref matches Staging | NOT PERFORMED |
| 5 | Read-only preflight | Preflight query results captured | NOT PERFORMED |
| 6 | Migration dry run | Dry-run notes / planner output | NOT PERFORMED |
| 7 | SQL apply in Staging only | Apply log (Staging) | NOT PERFORMED |
| 8 | Post-apply verification queries | Results from verification pack | NOT PERFORMED |
| 9 | Repository adapter smoke test | Memory/live adapter smoke notes | NOT PERFORMED |
| 10 | Registration lifecycle smoke test | Draft → submit → review evidence | NOT PERFORMED |
| 11 | Eligibility smoke test | Eligible / ineligible cases | NOT PERFORMED |
| 12 | Capacity and waitlist smoke test | Reserve / waitlist / promote evidence | NOT PERFORMED |
| 13 | Audit verification | Append-only + required metadata | NOT PERFORMED |
| 14 | RLS and grant verification | Deny-all RLS + no client write grants | NOT PERFORMED |
| 15 | Rollback decision window | Time-boxed Owner window documented | NOT PERFORMED |
| 16 | Evidence capture | Logs, query outputs, screenshots | NOT PERFORMED |
| 17 | Owner sign-off | Staging acceptance signature | NOT PERFORMED |
| 18 | Separate Production rollout decision | Explicit Production GO / NO-GO | NOT PERFORMED |

---

## Explicit non-actions for Phase 1G

- Do not connect to Staging or Production databases from this branch work.
- Do not apply SQL.
- Do not activate client RLS tenant policies beyond authored deny-all.
- Do not enable Core-02 Entry creation.
- Do not deploy.
- Do not mutate Production.

## Rollback note

Rollback SQL drops Core-03 Phase 1F objects. Consequences:

- All Core-03 authored tables/data for this migration are removed.
- Sibling/legacy tables are not modified by rollback.
- Re-apply requires a fresh Owner GO + backup/restore review.
