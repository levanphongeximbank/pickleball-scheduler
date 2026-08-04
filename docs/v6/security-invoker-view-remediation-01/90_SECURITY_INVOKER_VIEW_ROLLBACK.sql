-- Phase 6 / SECURITY_INVOKER_VIEW_REMEDIATION_01 rollback
-- STAGING CANDIDATE ONLY. DO NOT APPLY WITHOUT OWNER ROLLBACK GO.
-- This restores only the two reloptions changed by the forward migration.
-- Data mutations: 0. View definitions and ACLs remain unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter view public.tenants
  reset (security_invoker);

alter view public.club_data_v3_safe
  reset (security_invoker);

commit;
