-- Phase TT-5D — Server access guards + unified assignment write checks (Staging only)
-- Production impact: NONE

-- ═══════════════════════════════════════════════════════════════════
-- 1. Patch assignment helper — expires_at + effective status
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.referee_v5_current_user_has_assignment(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_roles text[] default array['REFEREE', 'SCOREKEEPER']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.referee_assignments ra
    where ra.tenant_id = p_tenant_id
      and ra.tournament_id = p_tournament_id
      and ra.match_id = p_match_id
      and ra.referee_user_id = auth.uid()
      and ra.role = any (p_roles)
      and public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at) = 'active'
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Assert assignment for write (returns block code)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.referee_v5_assert_assignment_write(
  p_tenant_id text,
  p_tournament_id text,
  p_match_id text,
  p_actor_id uuid,
  p_allow_read_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.referee_assignments;
  v_effective text;
  v_link public.team_sub_match_referee_links;
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_live public.match_live_states;
  v_state_id text;
  v_finalized boolean := false;
begin
  if p_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'canWrite', false);
  end if;

  select * into v_row
  from public.referee_assignments ra
  where ra.tenant_id = p_tenant_id
    and ra.tournament_id = p_tournament_id
    and ra.match_id = p_match_id
    and ra.referee_user_id = p_actor_id
    and ra.role in ('REFEREE', 'SCOREKEEPER', 'HEAD_REFEREE')
  order by ra.assigned_at desc
  limit 1;

  if v_row.id is null then
    perform public.team_tournament_write_audit(
      p_tenant_id, p_tournament_id,
      'team.referee_v5.access_denied', p_match_id,
      jsonb_build_object('code', 'REFEREE_NOT_ASSIGNED', 'actorId', p_actor_id)
    );
    return jsonb_build_object('ok', false, 'code', 'REFEREE_NOT_ASSIGNED', 'canWrite', false);
  end if;

  v_effective := public.referee_v5_assignment_effective_status(
    v_row.status, v_row.expires_at, v_row.revoked_at
  );

  if v_effective = 'expired' and v_row.status = 'active' and not p_allow_read_only then
    update public.referee_assignments set
      status = 'expired',
      version = version + 1,
      updated_at = now()
    where id = v_row.id;
    v_row.status := 'expired';
  end if;

  if v_effective = 'expired' then
    perform public.team_tournament_write_audit(
      p_tenant_id, p_tournament_id,
      'team.referee_v5.assignment_expired', p_match_id,
      jsonb_build_object('assignmentId', v_row.id, 'expiresAt', v_row.expires_at)
    );
    return jsonb_build_object(
      'ok', false,
      'code', 'referee_assignment_expired',
      'canWrite', false,
      'readOnly', p_allow_read_only,
      'assignmentStatus', v_effective,
      'assignmentId', v_row.id
    );
  end if;

  if v_effective = 'revoked' then
    return jsonb_build_object(
      'ok', false,
      'code', 'referee_assignment_revoked',
      'canWrite', false,
      'readOnly', p_allow_read_only,
      'assignmentStatus', v_effective,
      'assignmentId', v_row.id,
      'revokeReason', v_row.revoke_reason
    );
  end if;

  if v_effective <> 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'referee_assignment_not_active',
      'canWrite', false,
      'assignmentStatus', v_effective,
      'assignmentId', v_row.id
    );
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is not null and v_header.tenant_id <> p_tenant_id then
    return jsonb_build_object('ok', false, 'code', 'cross_tenant_denied', 'canWrite', false);
  end if;

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.tenant_id = p_tenant_id
    and l.tournament_id = p_tournament_id
    and l.external_sub_match_id = p_match_id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'bridge_not_found',
      'canWrite', false,
      'assignmentStatus', v_effective,
      'assignmentId', v_row.id
    );
  end if;

  if v_link.referee_match_id <> p_match_id then
    return jsonb_build_object('ok', false, 'code', 'referee_match_id_mismatch', 'canWrite', false);
  end if;

  if v_link.referee_assignment_id is not null and v_link.referee_assignment_id <> v_row.id then
    return jsonb_build_object('ok', false, 'code', 'assignment_bridge_mismatch', 'canWrite', false);
  end if;

  select * into v_matchup from public.team_tournament_matchups where id = v_link.matchup_id;
  select * into v_sub_match from public.team_tournament_sub_matches where id = v_link.sub_match_id;

  if v_matchup.requires_republish then
    return jsonb_build_object(
      'ok', false,
      'code', 'requires_republish',
      'canWrite', false,
      'readOnly', true,
      'assignmentStatus', v_effective
    );
  end if;

  v_state_id := public.referee_v5_match_state_id(p_tenant_id, p_tournament_id, p_match_id);
  select * into v_live from public.match_live_states where id = v_state_id;
  v_finalized := v_live.status = 'locked'
    or v_link.status = 'finalized'
    or v_sub_match.result_confirmed_at is not null;

  if v_finalized and not p_allow_read_only then
    return jsonb_build_object(
      'ok', false,
      'code', 'match_finalized_read_only',
      'canWrite', false,
      'readOnly', true,
      'assignmentStatus', v_effective,
      'linkStatus', v_link.status
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case when v_finalized then 'read_only' else 'active' end,
    'canWrite', not v_finalized,
    'readOnly', v_finalized,
    'assignmentStatus', v_effective,
    'assignmentId', v_row.id,
    'assignmentVersion', v_row.version,
    'linkId', v_link.id,
    'linkStatus', v_link.status,
    'bridgeValid', true,
    'lineupPublished', true,
    'requiresRepublish', false,
    'matchFinalized', v_finalized,
    'expiresAt', v_row.expires_at
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Route guard RPC for /referee/match/:matchId
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_referee_match_access_ops(
  p_tournament_id text,
  p_match_id text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_assert jsonb;
  v_link public.team_sub_match_referee_links;
  v_pending_correction int := 0;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  v_assert := public.referee_v5_assert_assignment_write(
    v_header.tenant_id, v_header.tournament_id, p_match_id, auth.uid(), true
  );

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.tenant_id = v_header.tenant_id
    and l.external_sub_match_id = p_match_id
    and l.status <> 'revoked'
  limit 1;

  select count(*)::int into v_pending_correction
  from public.team_tournament_referee_correction_requests c
  where c.tenant_id = v_header.tenant_id
    and c.external_sub_match_id = p_match_id
    and c.status = 'pending';

  return json_build_object(
    'ok', coalesce((v_assert->>'ok')::boolean, false) or coalesce((v_assert->>'readOnly')::boolean, false),
    'tenantId', v_header.tenant_id,
    'tournamentId', v_header.tournament_id,
    'matchId', p_match_id,
    'refereeMatchId', coalesce(v_link.referee_match_id, p_match_id),
    'canWrite', coalesce((v_assert->>'canWrite')::boolean, false),
    'readOnly', coalesce((v_assert->>'readOnly')::boolean, false),
    'blockCode', v_assert->>'code',
    'assignmentStatus', v_assert->>'assignmentStatus',
    'assignmentId', v_assert->>'assignmentId',
    'assignmentVersion', v_assert->>'assignmentVersion',
    'linkStatus', coalesce(v_assert->>'linkStatus', v_link.status),
    'bridgeValid', coalesce((v_assert->>'bridgeValid')::boolean, v_link.id is not null),
    'matchFinalized', coalesce((v_assert->>'matchFinalized')::boolean, false),
    'expiresAt', v_assert->>'expiresAt',
    'revokeReason', v_assert->>'revokeReason',
    'pendingCorrectionCount', v_pending_correction,
    'lastResultRevisionId', v_link.last_result_revision_id,
    'workspaceRoute', '/referee/match/' || p_match_id
  );
end;
$$;

-- Commit transition/finalization assignment gates: enforced via
-- referee_v5_assert_assignment_write in access_ops + existing V5-D32 expires_at checks.
-- Do not replace referee_v5_commit_match_transition body here (TT-5D scope).

revoke all on function public.referee_v5_assert_assignment_write(
  text, text, text, uuid, boolean
) from public, anon;
grant execute on function public.referee_v5_assert_assignment_write(
  text, text, text, uuid, boolean
) to authenticated, service_role;

revoke all on function public.team_tournament_referee_match_access_ops(text, text) from public, anon;
grant execute on function public.team_tournament_referee_match_access_ops(text, text) to authenticated;

revoke all on function public.referee_v5_current_user_has_assignment(text, text, text, text[]) from public;
grant execute on function public.referee_v5_current_user_has_assignment(text, text, text, text[]) to authenticated;
