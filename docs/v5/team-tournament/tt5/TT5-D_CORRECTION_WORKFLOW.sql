-- Phase TT-5D — Correction request workflow (Staging only)
-- Production impact: NONE

create table if not exists public.team_tournament_referee_correction_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid references public.team_tournaments (id) on delete cascade,
  matchup_id uuid references public.team_tournament_matchups (id) on delete set null,
  sub_match_id uuid references public.team_tournament_sub_matches (id) on delete set null,
  external_sub_match_id text not null,
  match_id text not null,
  result_revision_id uuid references public.match_result_revisions (id) on delete set null,
  proposed_score jsonb not null default '{}'::jsonb,
  proposed_winner text,
  reason text not null,
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  request_id text not null,
  version integer not null default 1,
  idempotency_key text,
  assignment_id uuid references public.referee_assignments (id) on delete set null,
  new_revision_id uuid references public.match_result_revisions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tournament_id, request_id)
);

create index if not exists tt5d_correction_pending_idx
  on public.team_tournament_referee_correction_requests (tenant_id, tournament_id, status)
  where status = 'pending';

alter table public.team_tournament_referee_correction_requests enable row level security;

drop policy if exists tt5d_correction_referee_select on public.team_tournament_referee_correction_requests;
create policy tt5d_correction_referee_select
  on public.team_tournament_referee_correction_requests
  for select
  to authenticated
  using (
    public.team_tournament_can_manage()
    or requested_by = auth.uid()
    or exists (
      select 1 from public.referee_assignments ra
      where ra.id = assignment_id and ra.referee_user_id = auth.uid()
    )
  );

drop policy if exists tt5d_correction_no_client_write on public.team_tournament_referee_correction_requests;
create policy tt5d_correction_no_client_write
  on public.team_tournament_referee_correction_requests
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on public.team_tournament_referee_correction_requests from anon;
grant select on public.team_tournament_referee_correction_requests to authenticated;
grant all on public.team_tournament_referee_correction_requests to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- Referee: request correction (no direct official edit)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_request_referee_correction(
  p_tournament_id text,
  p_match_id text,
  p_result_revision_id uuid,
  p_proposed_score jsonb,
  p_proposed_winner text,
  p_reason text,
  p_request_id text,
  p_expected_revision_version integer default null,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_assert jsonb;
  v_link public.team_sub_match_referee_links;
  v_revision public.match_result_revisions;
  v_row public.team_tournament_referee_correction_requests;
  v_cmd json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object('ok', false, 'code', 'CORRECTION_REASON_REQUIRED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_assert := public.referee_v5_assert_assignment_write(
    v_header.tenant_id, v_header.tournament_id, p_match_id, auth.uid(), true
  );

  if coalesce(v_assert->>'assignmentStatus', '') in ('expired', 'revoked') then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_assert->>'code', 'referee_assignment_expired')
    );
  end if;

  if not coalesce((v_assert->>'matchFinalized')::boolean, false) then
    return json_build_object('ok', false, 'code', 'match_not_finalized');
  end if;

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.tenant_id = v_header.tenant_id
    and l.external_sub_match_id = p_match_id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is null then
    return json_build_object('ok', false, 'code', 'bridge_not_found');
  end if;

  select * into v_revision
  from public.match_result_revisions r
  where r.id = p_result_revision_id
    and r.tenant_id = v_header.tenant_id
    and r.match_id = p_match_id;

  if v_revision.id is null then
    return json_build_object('ok', false, 'code', 'REVISION_NOT_FOUND');
  end if;

  if v_link.last_result_revision_id is not null
     and v_link.last_result_revision_id <> p_result_revision_id then
    return json_build_object('ok', false, 'code', 'stale_revision');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'request_referee_correction', p_idempotency_key,
    jsonb_build_object('requestId', p_request_id, 'matchId', p_match_id)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_row
  from public.team_tournament_referee_correction_requests c
  where c.tenant_id = v_header.tenant_id
    and c.tournament_id = v_header.tournament_id
    and c.request_id = p_request_id;

  if v_row.id is not null then
    return json_build_object(
      'ok', true,
      'replayed', true,
      'correctionRequestId', v_row.id,
      'status', v_row.status
    );
  end if;

  if exists (
    select 1 from public.team_tournament_referee_correction_requests c
    where c.tenant_id = v_header.tenant_id
      and c.external_sub_match_id = p_match_id
      and c.status = 'pending'
  ) then
    return json_build_object('ok', false, 'code', 'correction_already_pending');
  end if;

  insert into public.team_tournament_referee_correction_requests (
    tenant_id, tournament_id, team_tournament_id,
    matchup_id, sub_match_id, external_sub_match_id, match_id,
    result_revision_id, proposed_score, proposed_winner,
    reason, requested_by, request_id, idempotency_key, assignment_id, version
  ) values (
    v_header.tenant_id, v_header.tournament_id, v_header.id,
    v_link.matchup_id, v_link.sub_match_id, p_match_id, p_match_id,
    p_result_revision_id, coalesce(p_proposed_score, '{}'::jsonb), p_proposed_winner,
    p_reason, auth.uid(), p_request_id, p_idempotency_key,
    (v_assert->>'assignmentId')::uuid, 1
  )
  returning * into v_row;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.correction_requested', p_match_id,
    jsonb_build_object(
      'correctionRequestId', v_row.id,
      'requestId', p_request_id,
      'resultRevisionId', p_result_revision_id,
      'proposedScore', p_proposed_score,
      'proposedWinner', p_proposed_winner
    )
  );

  return json_build_object(
    'ok', true,
    'correctionRequestId', v_row.id,
    'requestId', v_row.request_id,
    'status', v_row.status,
    'version', v_row.version
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- BTC: approve / reject correction
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_review_referee_correction(
  p_tournament_id text,
  p_correction_request_id uuid,
  p_decision text,
  p_review_reason text default null,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_row public.team_tournament_referee_correction_requests;
  v_apply jsonb;
  v_consume jsonb;
  v_outbox_id uuid;
  v_cmd json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if lower(coalesce(p_decision, '')) not in ('approve', 'reject') then
    return json_build_object('ok', false, 'code', 'INVALID_DECISION');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'review_referee_correction', p_idempotency_key,
    jsonb_build_object('correctionRequestId', p_correction_request_id, 'decision', p_decision)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_row
  from public.team_tournament_referee_correction_requests
  where id = p_correction_request_id
    and tenant_id = v_header.tenant_id
    and tournament_id = v_header.tournament_id
  for update;

  if v_row.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_expected_version is not null and v_row.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_referee_correction_requests', p_expected_version, v_row.version
    );
  end if;

  if v_row.status <> 'pending' then
    return json_build_object(
      'ok', true,
      'replayed', true,
      'status', v_row.status,
      'correctionRequestId', v_row.id
    );
  end if;

  if lower(p_decision) = 'reject' then
    if p_review_reason is null or btrim(p_review_reason) = '' then
      return json_build_object('ok', false, 'code', 'REVIEW_REASON_REQUIRED');
    end if;

    update public.team_tournament_referee_correction_requests set
      status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_reason = p_review_reason,
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

    perform public.team_tournament_write_audit(
      v_header.tenant_id, v_header.tournament_id,
      'team.referee_v5.correction_rejected', v_row.match_id,
      jsonb_build_object(
        'correctionRequestId', v_row.id,
        'reviewReason', p_review_reason
      )
    );

    return json_build_object(
      'ok', true,
      'status', 'rejected',
      'correctionRequestId', v_row.id,
      'version', v_row.version
    );
  end if;

  v_apply := public.referee_v5_apply_admin_result_revision(
    v_header.tenant_id,
    v_header.tournament_id,
    v_row.match_id,
    auth.uid(),
    'overridden',
    v_row.proposed_score,
    v_row.proposed_winner,
    coalesce(p_review_reason, v_row.reason),
    'correction::' || v_row.request_id,
    v_row.result_revision_id
  );

  if not coalesce((v_apply->>'ok')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_apply->>'code', 'correction_apply_failed'),
      'detail', v_apply
    );
  end if;

  v_outbox_id := (v_apply->>'outboxId')::uuid;

  if v_outbox_id is not null then
    v_consume := public.team_tournament_consume_referee_v5_outbox(
      v_outbox_id,
      'correction_' || v_row.request_id
    );
  end if;

  update public.team_tournament_referee_correction_requests set
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_reason = p_review_reason,
    new_revision_id = (v_apply->>'revisionId')::uuid,
    version = version + 1,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.correction_approved', v_row.match_id,
    jsonb_build_object(
      'correctionRequestId', v_row.id,
      'newRevisionId', v_row.new_revision_id,
      'consume', v_consume
    )
  );

  return json_build_object(
    'ok', true,
    'status', 'approved',
    'correctionRequestId', v_row.id,
    'newRevisionId', v_row.new_revision_id,
    'outboxId', v_outbox_id,
    'propagation', v_consume,
    'version', v_row.version
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- List correction requests (BTC)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_list_referee_corrections(
  p_tournament_id text,
  p_status text default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_items jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'correctionRequestId', c.id,
    'requestId', c.request_id,
    'matchId', c.match_id,
    'status', c.status,
    'proposedScore', c.proposed_score,
    'proposedWinner', c.proposed_winner,
    'reason', c.reason,
    'requestedAt', c.requested_at,
    'reviewedAt', c.reviewed_at,
    'reviewReason', c.review_reason,
    'resultRevisionId', c.result_revision_id,
    'newRevisionId', c.new_revision_id,
    'version', c.version
  ) order by c.requested_at desc), '[]'::jsonb)
  into v_items
  from public.team_tournament_referee_correction_requests c
  where c.tenant_id = v_header.tenant_id
    and c.tournament_id = v_header.tournament_id
    and (p_status is null or c.status = p_status);

  return json_build_object('ok', true, 'corrections', v_items);
end;
$$;

revoke all on function public.team_tournament_request_referee_correction(
  text, text, uuid, jsonb, text, text, text, integer, text
) from public, anon;
grant execute on function public.team_tournament_request_referee_correction(
  text, text, uuid, jsonb, text, text, text, integer, text
) to authenticated;

revoke all on function public.team_tournament_review_referee_correction(
  text, uuid, text, text, integer, text
) from public, anon;
grant execute on function public.team_tournament_review_referee_correction(
  text, uuid, text, text, integer, text
) to authenticated;

revoke all on function public.team_tournament_list_referee_corrections(text, text) from public, anon;
grant execute on function public.team_tournament_list_referee_corrections(text, text) to authenticated;
