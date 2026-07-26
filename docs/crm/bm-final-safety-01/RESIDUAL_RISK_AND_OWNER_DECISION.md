# Residual Risk and Owner Decision

## Resolved by the Staging grant remediation

- Excess `authenticated` privileges (`DELETE`, `TRUNCATE`, `REFERENCES`,
  `TRIGGER`) removed from the four CRM tables, keeping `DELETE` on
  `crm_tag_assignments` per the canonical design.
- `anon` EXECUTE removed from `crm_phase1g_scope_allows(text, text)`.
- Apply replay is now blocked by a one-time, non-replayable authorization bound
  to operation, Staging ref and SQL fingerprint.
- The Production block is terminal and cannot be downgraded by a later gate.

## Residual risks after remediation

- Residual `UPDATE` grants intentionally retained under the deferred contract:
  - `crm_tag_assignments.UPDATE` — no UPDATE policy exists, so RLS denies all
    rows; the grant is unreachable but still present.
  - `crm_consent_records.UPDATE` — immutability enforced by the
    `crm_consent_records_immutable_guard` trigger and the absence of an UPDATE
    policy.
- `authenticated` EXECUTE on `crm_consent_records_immutable_guard` remains; it
  is a trigger function and was out of the certified remediation scope.
- CRM role-matrix migration (order 8) is still deferred: 0 CRM role-matrix rows
  on Staging, so CRM permissions are not yet grantable through the role matrix.
- Grant drift can recur if a future migration re-runs `GRANT ALL`-style
  statements; the guard prevents unauthorized apply, not permissive SQL content.
- Staging remains unverified for application-level QA after the privilege
  tightening; the change is expected to be behaviour-neutral because RLS already
  denied the revoked operations, but no functional QA pass has been run.

## Deferred work

- A follow-up decision on whether to revoke the two residual `UPDATE` grants and
  the trigger-function EXECUTE.
- CRM role-matrix migration (order 8) under a fresh one-time authorization.
- Application-level QA on Staging after the privilege tightening.
- Commit / push / PR (only when the Owner requests them).

## Owner decision required now

Decide whether to commit the BM-FINAL-SAFETY-01 changes to
`feature/bm-final-safety-01-crm-staging-reapply-guard` and open the PR, or to
hold. Nothing has been committed, pushed, or opened as a PR.
