-- M8 Competition Remote SSOT — RLS (tenant isolation; deny anon direct writes)
BEGIN;

ALTER TABLE public.competition_ssot_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_finalized_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_standings_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_idempotency ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.competition_ssot_competitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_matches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_finalized_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_standings_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_command_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ssot_idempotency FORCE ROW LEVEL SECURITY;

-- Helper: reuse user_venue_id() when present; otherwise deny.
-- Policies require authenticated + tenant match via user_venue_id().

DROP POLICY IF EXISTS competition_ssot_competitions_tenant_select ON public.competition_ssot_competitions;
CREATE POLICY competition_ssot_competitions_tenant_select
  ON public.competition_ssot_competitions FOR SELECT TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin());

DROP POLICY IF EXISTS competition_ssot_competitions_tenant_write ON public.competition_ssot_competitions;
CREATE POLICY competition_ssot_competitions_tenant_write
  ON public.competition_ssot_competitions FOR ALL TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_venue_id() OR public.is_super_admin());

DROP POLICY IF EXISTS competition_ssot_participants_tenant_all ON public.competition_ssot_participants;
CREATE POLICY competition_ssot_participants_tenant_all
  ON public.competition_ssot_participants FOR ALL TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_venue_id() OR public.is_super_admin());

DROP POLICY IF EXISTS competition_ssot_matches_tenant_all ON public.competition_ssot_matches;
CREATE POLICY competition_ssot_matches_tenant_all
  ON public.competition_ssot_matches FOR ALL TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_venue_id() OR public.is_super_admin());

-- Finalized results: SELECT for tenant; INSERT/UPDATE/DELETE denied to clients
-- (RPC security definer is the sole writer).
DROP POLICY IF EXISTS competition_ssot_finalized_tenant_select ON public.competition_ssot_finalized_results;
CREATE POLICY competition_ssot_finalized_tenant_select
  ON public.competition_ssot_finalized_results FOR SELECT TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin());

DROP POLICY IF EXISTS competition_ssot_finalized_deny_client_write ON public.competition_ssot_finalized_results;
CREATE POLICY competition_ssot_finalized_deny_client_write
  ON public.competition_ssot_finalized_results AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS competition_ssot_finalized_deny_client_update ON public.competition_ssot_finalized_results;
CREATE POLICY competition_ssot_finalized_deny_client_update
  ON public.competition_ssot_finalized_results AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS competition_ssot_finalized_deny_client_delete ON public.competition_ssot_finalized_results;
CREATE POLICY competition_ssot_finalized_deny_client_delete
  ON public.competition_ssot_finalized_results AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS competition_ssot_standings_tenant_all ON public.competition_ssot_standings_snapshots;
CREATE POLICY competition_ssot_standings_tenant_all
  ON public.competition_ssot_standings_snapshots FOR ALL TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_venue_id() OR public.is_super_admin());

DROP POLICY IF EXISTS competition_ssot_command_tenant_select ON public.competition_ssot_command_log;
CREATE POLICY competition_ssot_command_tenant_select
  ON public.competition_ssot_command_log FOR SELECT TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin());

DROP POLICY IF EXISTS competition_ssot_audit_tenant_select ON public.competition_ssot_audit_events;
CREATE POLICY competition_ssot_audit_tenant_select
  ON public.competition_ssot_audit_events FOR SELECT TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin());

DROP POLICY IF EXISTS competition_ssot_idempotency_tenant_all ON public.competition_ssot_idempotency;
CREATE POLICY competition_ssot_idempotency_tenant_all
  ON public.competition_ssot_idempotency FOR ALL TO authenticated
  USING (tenant_id = public.user_venue_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_venue_id() OR public.is_super_admin());

-- Anon: no policies → deny under FORCE RLS
REVOKE ALL ON public.competition_ssot_competitions FROM anon;
REVOKE ALL ON public.competition_ssot_participants FROM anon;
REVOKE ALL ON public.competition_ssot_matches FROM anon;
REVOKE ALL ON public.competition_ssot_finalized_results FROM anon;
REVOKE ALL ON public.competition_ssot_standings_snapshots FROM anon;
REVOKE ALL ON public.competition_ssot_command_log FROM anon;
REVOKE ALL ON public.competition_ssot_audit_events FROM anon;
REVOKE ALL ON public.competition_ssot_idempotency FROM anon;

COMMIT;
