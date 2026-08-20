-- ═══════════════════════════════════════════════════════════════════
-- 07_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY_ROLLBACK.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- ROLLBACK_EXECUTION_GO=NO
--
-- Restores EXACTLY the pre-apply Staging definition of
-- public.competition_assignment_assert_mutation_boundary
-- captured via pg_get_functiondef on 2026-08-20.
--
-- PRE_APPLY_FUNCTION_DEFINITION_SHA256=
--   d0b889c963a73b9c1eefeebed2857e8b05060bff145634006fa3caad944f2345
-- TARGET_PROJECT=qyewbxjsiiyufanzcjcq
-- PRODUCTION_ACCESS_GO=NO
-- DO NOT EXECUTE unless a later Owner GO is issued.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.competition_assignment_assert_mutation_boundary(p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_operation text, p_emergency_replacement boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid;
  v_jwt_role text;
  v_canonical public.canonical_tournaments;
  v_header public.team_tournaments;
  v_live public.match_live_states;
  v_sm public.team_tournament_sub_matches;
  v_mu public.team_tournament_matchups;
  v_lifecycle text := 'PRE_MATCH';
  v_op text;
  v_mid text;
  v_daily jsonb;
  v_match jsonb;
begin
  v_jwt_role := coalesce(auth.role(), '');
  if v_jwt_role is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED'
      using detail = 'competition_* assignment RPCs are trusted-server service_role only';
  end if;

  if p_actor_id is null then
    raise exception 'ORIGINATING_ACTOR_REQUIRED'
      using detail = 'trusted server must pass authenticated originating actor; auth.uid() is not the end user under service_role';
  end if;

  v_actor := p_actor_id;

  if nullif(trim(coalesce(p_tenant_id, '')), '') is null
     or nullif(trim(coalesce(p_tournament_id, '')), '') is null
     or nullif(trim(coalesce(p_match_id, '')), '') is null then
    raise exception 'INVALID_INPUT'
      using detail = 'tenant_id, tournament_id, match_id required';
  end if;

  v_op := upper(trim(coalesce(p_operation, '')));
  if v_op not in ('ASSIGN', 'REPLACE', 'UNASSIGN') then
    raise exception 'INVALID_INPUT' using detail = format('unsupported operation=%s', p_operation);
  end if;

  -- Tournament-in-tenant bind (data integrity). JWT permission is asserted
  -- by the trusted server with the user-scoped client before this RPC.
  select * into v_canonical
  from public.canonical_tournaments ct
  where ct.tenant_id = p_tenant_id
    and (ct.id::text = p_tournament_id or ct.external_key = p_tournament_id)
  limit 1;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is not null then
    if v_header.tenant_id is distinct from p_tenant_id then
      raise exception 'CROSS_TENANT_DENIED'
        using detail = 'bound team tournament tenant does not match p_tenant_id';
    end if;
  end if;

  if v_canonical.id is null and v_header.id is null then
    raise exception 'CROSS_TOURNAMENT_DENIED'
      using detail = 'tournament is not bound in caller tenant';
  end if;

  -- Tournament-level lifecycle (authoritative row, not caller claim).
  if v_canonical.id is not null and v_canonical.status in ('completed', 'cancelled') then
    v_lifecycle := 'COMPLETED';
  end if;
  if v_header.id is not null and v_header.status in ('completed', 'cancelled') then
    v_lifecycle := 'COMPLETED';
  end if;

  v_mid := trim(p_match_id);

  select * into v_live
  from public.match_live_states mls
  where mls.tenant_id = p_tenant_id
    and mls.match_id = v_mid
    and mls.tournament_id in (
      p_tournament_id,
      coalesce(v_canonical.id::text, ''),
      coalesce(v_canonical.external_key, ''),
      coalesce(v_header.tournament_id, '')
    )
  order by mls.updated_at desc nulls last
  limit 1;

  if v_live.id is not null then
    if v_live.status in ('completed', 'cancelled') then
      v_lifecycle := 'COMPLETED';
    elsif v_live.status in ('locked', 'paused', 'disputed') then
      v_lifecycle := 'LOCKED';
    elsif v_live.status in ('in_progress', 'game_break') then
      if coalesce(v_live.last_event_sequence, 0) > 0
         or coalesce(v_live.team_a_score, 0) > 0
         or coalesce(v_live.team_b_score, 0) > 0 then
        v_lifecycle := 'SCORING_ACTIVE';
      else
        v_lifecycle := 'IN_PROGRESS';
      end if;
    elsif v_live.status = 'not_started' and v_lifecycle not in ('COMPLETED', 'LOCKED') then
      v_lifecycle := 'PRE_MATCH';
    end if;
  end if;

  if v_header.id is not null then
    select * into v_sm
    from public.team_tournament_sub_matches sm
    where sm.tenant_id = p_tenant_id
      and sm.tournament_id = v_header.tournament_id
      and sm.external_sub_match_id = v_mid
    limit 1;

    if v_sm.id is not null then
      if v_sm.status in ('completed', 'forfeit') or v_sm.result_confirmed_at is not null then
        v_lifecycle := 'COMPLETED';
      elsif v_sm.status = 'playing' and v_lifecycle not in ('COMPLETED', 'LOCKED', 'SCORING_ACTIVE') then
        v_lifecycle := 'IN_PROGRESS';
      end if;
    end if;

    select * into v_mu
    from public.team_tournament_matchups mu
    where mu.tenant_id = p_tenant_id
      and mu.team_tournament_id = v_header.id
      and mu.external_matchup_id = v_mid
    limit 1;

    if v_mu.id is not null then
      if v_mu.status = 'completed' then
        v_lifecycle := 'COMPLETED';
      elsif v_mu.status = 'locked' then
        v_lifecycle := 'LOCKED';
      elsif v_mu.status = 'in_progress'
            and v_lifecycle not in ('COMPLETED', 'LOCKED', 'SCORING_ACTIVE') then
        v_lifecycle := 'IN_PROGRESS';
      end if;
    end if;
  end if;

  if v_canonical.id is not null and v_canonical.mode = 'daily_play' then
    v_daily := coalesce(v_canonical.payload#>'{settings,dailyPlay,matches}', '[]'::jsonb);
    if jsonb_typeof(v_daily) = 'array' then
      select value into v_match
      from jsonb_array_elements(v_daily) e(value)
      where coalesce(e.value->>'id', e.value->>'matchId') = v_mid
      limit 1;
      if v_match is not null then
        if lower(coalesce(v_match->>'status', '')) in (
          'completed', 'complete', 'finished', 'final', 'closed', 'cancelled'
        ) then
          v_lifecycle := 'COMPLETED';
        elsif lower(coalesce(v_match->>'status', '')) in ('locked', 'suspended', 'paused') then
          v_lifecycle := 'LOCKED';
        elsif lower(coalesce(v_match->>'status', '')) in ('scoring', 'scoring_active', 'score_entry') then
          v_lifecycle := 'SCORING_ACTIVE';
        elsif lower(coalesce(v_match->>'status', '')) in ('in_progress', 'active', 'started', 'live', 'playing')
              and v_lifecycle not in ('COMPLETED', 'LOCKED', 'SCORING_ACTIVE') then
          v_lifecycle := 'IN_PROGRESS';
        end if;
      end if;
    end if;
  end if;

  -- Owner non-negotiable mutation invariants (not CORE-13 planning).
  if v_lifecycle in ('LOCKED', 'COMPLETED') then
    raise exception 'LIFECYCLE_DENIED'
      using detail = format('%s forbids assign/replace/unassign', v_lifecycle);
  end if;

  if v_lifecycle = 'IN_PROGRESS' then
    if v_op = 'ASSIGN' then
      raise exception 'LIFECYCLE_DENIED'
        using detail = 'IN_PROGRESS forbids new assignment (use atomic replace)';
    end if;
    if v_op = 'UNASSIGN' then
      raise exception 'UNASSIGN_WITHOUT_REPLACEMENT_DENIED'
        using detail = 'IN_PROGRESS forbids unassign without replacement';
    end if;
  end if;

  if v_lifecycle = 'SCORING_ACTIVE' then
    if v_op = 'ASSIGN' then
      raise exception 'LIFECYCLE_DENIED'
        using detail = 'SCORING_ACTIVE forbids normal assign';
    end if;
    if v_op = 'UNASSIGN' then
      raise exception 'UNASSIGN_WITHOUT_REPLACEMENT_DENIED'
        using detail = 'SCORING_ACTIVE forbids unassign without replacement';
    end if;
    if v_op = 'REPLACE' and coalesce(p_emergency_replacement, false) is not true then
      raise exception 'EMERGENCY_REPLACEMENT_REQUIRED'
        using detail = 'SCORING_ACTIVE requires explicit emergencyReplacement=true';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'actorId', v_actor,
    'lifecycleState', v_lifecycle,
    'tenantId', p_tenant_id,
    'tournamentId', p_tournament_id,
    'matchId', v_mid,
    'canonicalBound', (v_canonical.id is not null),
    'teamBound', (v_header.id is not null),
    'trustedServerDelegation', true,
    'jwtRole', v_jwt_role,
    'authUid', auth.uid()
  );
end;
$function$
