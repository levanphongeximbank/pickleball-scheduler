-- TT-6B — Realtime SELECT RLS (STAGING ONLY)
-- Defense-in-depth for postgres_changes delivery.
-- Requires existing role helpers from TT-1B/TT-5.
-- Note: team_tournament_assert_tenant() returns void (RPC guard only); policies use boolean tenant match.

CREATE OR REPLACE FUNCTION public.team_tournament_tenant_allowed(p_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR p_tenant_id = (SELECT venue_id FROM public.profiles WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.team_tournament_is_matchup_participant(p_matchup_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_tournament_matchups m
    WHERE m.id = p_matchup_id
      AND (
        public.team_tournament_can_manage()
        OR (
          public.team_tournament_user_player_id() IS NOT NULL
          AND (
            public.team_tournament_is_captain(
              m.team_tournament_id, m.team_a_id, public.team_tournament_user_player_id()
            )
            OR public.team_tournament_is_captain(
              m.team_tournament_id, m.team_b_id, public.team_tournament_user_player_id()
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.team_tournament_is_sub_match_participant(p_sub_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.team_tournament_is_matchup_participant(
    (SELECT matchup_id FROM public.team_tournament_sub_matches WHERE id = p_sub_match_id)
  );
$$;

REVOKE ALL ON FUNCTION public.team_tournament_tenant_allowed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_tournament_is_matchup_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_tournament_is_sub_match_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_tournament_tenant_allowed(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_is_matchup_participant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_is_sub_match_participant(uuid) TO authenticated, service_role;

-- Matchups: manage + participants
ALTER TABLE public.team_tournament_matchups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tt6_matchups_realtime_select ON public.team_tournament_matchups;
CREATE POLICY tt6_matchups_realtime_select ON public.team_tournament_matchups
  FOR SELECT TO authenticated
  USING (
    public.team_tournament_tenant_allowed(tenant_id)
    AND (
      public.team_tournament_can_manage()
      OR public.team_tournament_is_matchup_participant(id)
    )
  );

-- Sub-matches: manage + participants + active referee link
ALTER TABLE public.team_tournament_sub_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tt6_sub_matches_realtime_select ON public.team_tournament_sub_matches;
CREATE POLICY tt6_sub_matches_realtime_select ON public.team_tournament_sub_matches
  FOR SELECT TO authenticated
  USING (
    public.team_tournament_tenant_allowed(tenant_id)
    AND (
      public.team_tournament_can_manage()
      OR public.team_tournament_is_sub_match_participant(id)
      OR EXISTS (
        SELECT 1 FROM public.team_sub_match_referee_links l
        WHERE l.sub_match_id = team_tournament_sub_matches.id
          AND l.status IN ('pending', 'provisioned', 'assigned', 'active', 'finalized')
          AND l.revoked_at IS NULL
          AND public.referee_v5_current_user_has_assignment(
            l.tenant_id, l.tournament_id, l.referee_match_id
          )
      )
    )
  );

-- Bridge links: BTC manage + assigned referee (non-revoked)
ALTER TABLE public.team_sub_match_referee_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tt6_bridge_realtime_select ON public.team_sub_match_referee_links;
CREATE POLICY tt6_bridge_realtime_select ON public.team_sub_match_referee_links
  FOR SELECT TO authenticated
  USING (
    public.team_tournament_tenant_allowed(tenant_id)
    AND revoked_at IS NULL
    AND (
      public.team_tournament_can_manage()
      OR public.referee_v5_current_user_has_assignment(
        tenant_id, tournament_id, referee_match_id
      )
    )
  );
