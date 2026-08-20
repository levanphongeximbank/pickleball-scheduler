-- Wave 5 Staging remediation — 02_APPLY_CLUB_TRUNCATE.sql
-- TARGET=STAGING PROJECT_REF=qyewbxjsiiyufanzcjcq
-- AUTHORIZED_MUTATION=REVOKE TRUNCATE ONLY
-- AUTHORIZED_PRIVILEGE_EDGES=8
-- No GRANT. No other REVOKE. No ALTER/DROP/CREATE. No policy/RLS/data DML.

BEGIN;

REVOKE TRUNCATE ON TABLE
  public.clubs,
  public.club_members,
  public.club_governance_assignments,
  public.club_membership_requests_v42
FROM anon, authenticated;

COMMIT;
