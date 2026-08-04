# Public Surface Allowlist Reconciliation

Result: PASS WITH OBSERVATIONS.

- Anonymous/public table grants on public/storage: `0`.
- Anonymous executable `SECURITY DEFINER` routines: `7` and fully inventoried.
- The inventoried seven-function surface matches the expected audited exposure class for this phase.

Observation:

- `public.news_public_content_query_public(...)` appears in Security Advisor as anonymous executable `SECURITY DEFINER`; retained as intentional until owner disposition for remediation phase.
