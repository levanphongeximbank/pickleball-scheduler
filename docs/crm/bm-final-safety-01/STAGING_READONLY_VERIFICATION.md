# Staging Read-Only Verification

## Assurance

Command:

`node scripts/crm/bm-final-safety-01-staging-readonly-verify.mjs`

The verifier targets only `qyewbxjsiiyufanzcjcq`, starts with
`BEGIN TRANSACTION READ ONLY`, rejects mutating SQL tokens before connection,
uses catalog/aggregate SELECT queries, calls no application RPC, and ends with
`ROLLBACK`. The database attested `transaction_read_only=on`.

## Results

- Tables: 4/4 present; all ordinary tables; RLS enabled and forced.
- CRM views: 0.
- Functions: 4/4 present, `SECURITY DEFINER`, fixed
  `search_path=public, pg_temp`.
- Policies: expected 11 present, all assigned to `authenticated`.
- Indexes: expected named indexes and constraint-backed indexes present.
- Constraints: expected primary, unique, foreign-key and check constraints
  present.
- Consent immutable trigger: present.
- CRM table counts: all four tables have 0 rows.
- CRM permission rows: 24; duplicate IDs: 0.
- CRM role-matrix rows: 0; order 8 remains deferred.
- Duplicate public CRM relations: 0.
- Migration history: 141 total rows; 7 rows contain CRM naming. The incident
  apply script uses raw SQL and does not itself write migration history, so
  this count is supporting inventory rather than proof of incident execution.

## Grant drift

The migration intended narrow grants, but direct grants from `postgres` give
`authenticated` all seven legacy table privileges on each CRM table:
`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`.

This is excessive for every table. Examples:

- `crm_consent_records` should have only `SELECT, INSERT`.
- `crm_tags` should have only `SELECT, INSERT, UPDATE`.
- `crm_tag_assignments` should have only `SELECT, INSERT, DELETE`.
- `crm_pending_events` should have only `SELECT, INSERT, UPDATE`.

Additionally, `anon` has direct `EXECUTE` on
`crm_phase1g_scope_allows`, and `authenticated` has direct `EXECUTE` on the
internal consent trigger function. Supabase `public` default ACLs explain how
the broad grants were introduced at object creation; the migration revoked
`PUBLIC`/`anon` selectively but did not first revoke excess
`authenticated` privileges.

## Verdict

`CRM_STAGING_REAPPLY_POLICY_OR_GRANT_DRIFT_FOUND`

No data impact was found. A mutation was nevertheless required to restore the
intended least-privilege grant matrix.

## Post-remediation re-verification

The same verifier was re-run immediately after the Owner-approved grant
remediation committed. It again attested `transaction_read_only=on`, issued
`ROLLBACK`, and performed 0 writes and 0 application RPC calls.

Grant drift is resolved: `authenticated` now holds only the intended privileges
on all four CRM tables, and `anon` no longer holds `EXECUTE` on
`crm_phase1g_scope_allows`. Everything else is byte-identical to the
pre-mutation snapshot — same column fingerprint, same 11 policy expression
fingerprints, same 4 function definition fingerprints, same 26 constraints,
18 indexes and 1 trigger, same 24 CRM permission rows with the same fingerprint,
still 0 CRM role-matrix rows, still 0 rows in all four tables, still 0 duplicate
CRM relations, and RLS still enabled and forced on 4/4 tables.

Full before/after matrices are in `STAGING_GRANT_REMEDIATION_EXECUTION.md`.
