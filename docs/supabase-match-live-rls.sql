-- RLS staging: tournament_match_live — Pickleball Scheduler Pro v3.5.6
-- Chạy SAU: supabase-match-live.sql → supabase-rbac.sql
-- Rollback: docs/supabase-rls-rollback.sql
--
-- Referee flow: anon KHÔNG select/update trực tiếp — chỉ RPC token-scoped.
-- Staff/director: authenticated theo RBAC policies.

-- Gỡ policy anon mở hoàn toàn (từ supabase-match-live.sql)
drop policy if exists "tournament_match_live_anon_select" on public.tournament_match_live;
drop policy if exists "tournament_match_live_anon_insert" on public.tournament_match_live;
drop policy if exists "tournament_match_live_anon_update" on public.tournament_match_live;
drop policy if exists "tournament_match_live_anon_delete" on public.tournament_match_live;

-- Gỡ policy referee anon cũ (v3.5.5 — list-all risk)
drop policy if exists "match_live_referee_anon_select" on public.tournament_match_live;
drop policy if exists "match_live_referee_anon_insert" on public.tournament_match_live;
drop policy if exists "match_live_referee_anon_update" on public.tournament_match_live;

alter table public.tournament_match_live enable row level security;

-- Director / BTC: authenticated venue hoặc club staff
drop policy if exists "match_live_staff_select" on public.tournament_match_live;
create policy "match_live_staff_select"
  on public.tournament_match_live for select to authenticated
  using (
    public.is_super_admin()
    or club_id = public.user_club_id()
    or public.is_venue_staff()
  );

drop policy if exists "match_live_staff_insert" on public.tournament_match_live;
create policy "match_live_staff_insert"
  on public.tournament_match_live for insert to authenticated
  with check (
    public.is_super_admin()
    or public.user_role() in ('VENUE_OWNER', 'VENUE_MANAGER', 'CLUB_OWNER')
    or club_id = public.user_club_id()
  );

drop policy if exists "match_live_staff_update" on public.tournament_match_live;
create policy "match_live_staff_update"
  on public.tournament_match_live for update to authenticated
  using (
    public.is_super_admin()
    or public.user_role() in ('VENUE_OWNER', 'VENUE_MANAGER', 'CLUB_OWNER')
    or club_id = public.user_club_id()
  )
  with check (
    public.is_super_admin()
    or public.user_role() in ('VENUE_OWNER', 'VENUE_MANAGER', 'CLUB_OWNER')
    or club_id = public.user_club_id()
  );

drop policy if exists "match_live_staff_delete" on public.tournament_match_live;
create policy "match_live_staff_delete"
  on public.tournament_match_live for delete to authenticated
  using (public.is_super_admin());

-- ─── RPC token-scoped (referee anon) ─────────────────────────────

create or replace function public.referee_get_match_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tournament_match_live%rowtype;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;

  select *
  into v_row
  from public.tournament_match_live
  where referee_token = trim(p_token)
  limit 1;

  if not found then
    return null;
  end if;

  -- Chỉ trả field cần cho scoreboard; không lộ club_id / tournament_id
  return json_build_object(
    'id', v_row.id,
    'match_id', v_row.match_id,
    'referee_token', v_row.referee_token,
    'referee_name', v_row.referee_name,
    'tournament_name', v_row.tournament_name,
    'stage_label', v_row.stage_label,
    'entry_a_label', v_row.entry_a_label,
    'entry_b_label', v_row.entry_b_label,
    'court_label', v_row.court_label,
    'score_a', v_row.score_a,
    'score_b', v_row.score_b,
    'status', v_row.status,
    'is_daily', v_row.is_daily,
    'audit_log', v_row.audit_log,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.referee_update_match_score(p_token text, p_payload jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tournament_match_live%rowtype;
  v_action text;
  v_team text;
  v_delta int;
  v_score_a int;
  v_score_b int;
  v_old_a int;
  v_old_b int;
  v_entry jsonb;
  v_audit jsonb;
  v_user_agent text;
  v_note text;
  v_now timestamptz := now();
  v_actor text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;

  select *
  into v_row
  from public.tournament_match_live
  where referee_token = trim(p_token)
  for update;

  if not found then
    return null;
  end if;

  v_action := lower(coalesce(p_payload->>'action', ''));
  v_user_agent := left(coalesce(p_payload->>'userAgent', ''), 240);
  v_note := coalesce(p_payload->>'note', '');
  v_actor := coalesce(nullif(trim(v_row.referee_name), ''), 'Trọng tài');

  if v_action = 'adjust' then
    if v_row.status <> 'playing' then
      return null;
    end if;

    v_team := upper(coalesce(p_payload->>'team', ''));
    v_delta := coalesce((p_payload->>'delta')::int, 0);

    if v_team not in ('A', 'B') or v_delta = 0 then
      return null;
    end if;

    v_old_a := v_row.score_a;
    v_old_b := v_row.score_b;

    if v_team = 'A' then
      v_score_a := greatest(0, v_old_a + v_delta);
      v_score_b := v_old_b;
    else
      v_score_a := v_old_a;
      v_score_b := greatest(0, v_old_b + v_delta);
    end if;

    v_entry := jsonb_build_object(
      'id', 'log-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
      'at', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'source', 'referee',
      'action', 'adjust',
      'actorName', v_actor,
      'matchId', v_row.match_id,
      'refereeToken', v_row.referee_token,
      'team', v_team,
      'delta', v_delta,
      'oldScoreA', v_old_a,
      'oldScoreB', v_old_b,
      'scoreA', v_score_a,
      'scoreB', v_score_b,
      'userAgent', v_user_agent
    );

    v_audit := coalesce(v_row.audit_log, '[]'::jsonb) || v_entry;

    update public.tournament_match_live
    set
      score_a = v_score_a,
      score_b = v_score_b,
      audit_log = v_audit,
      updated_at = v_now
    where id = v_row.id
    returning * into v_row;

  elsif v_action = 'finalize' then
    if v_row.status <> 'playing' then
      return null;
    end if;

    v_old_a := v_row.score_a;
    v_old_b := v_row.score_b;
    v_score_a := greatest(0, coalesce((p_payload->>'scoreA')::int, v_old_a));
    v_score_b := greatest(0, coalesce((p_payload->>'scoreB')::int, v_old_b));

    v_entry := jsonb_build_object(
      'id', 'log-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
      'at', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'source', 'referee',
      'action', 'finalized',
      'actorName', v_actor,
      'matchId', v_row.match_id,
      'refereeToken', v_row.referee_token,
      'team', '',
      'delta', 0,
      'oldScoreA', v_old_a,
      'oldScoreB', v_old_b,
      'scoreA', v_score_a,
      'scoreB', v_score_b,
      'userAgent', v_user_agent,
      'note', v_note
    );

    v_audit := coalesce(v_row.audit_log, '[]'::jsonb) || v_entry;

    update public.tournament_match_live
    set
      score_a = v_score_a,
      score_b = v_score_b,
      status = 'finalize_requested',
      audit_log = v_audit,
      updated_at = v_now
    where id = v_row.id
    returning * into v_row;

  else
    return null;
  end if;

  return json_build_object(
    'id', v_row.id,
    'match_id', v_row.match_id,
    'referee_token', v_row.referee_token,
    'referee_name', v_row.referee_name,
    'tournament_name', v_row.tournament_name,
    'stage_label', v_row.stage_label,
    'entry_a_label', v_row.entry_a_label,
    'entry_b_label', v_row.entry_b_label,
    'court_label', v_row.court_label,
    'score_a', v_row.score_a,
    'score_b', v_row.score_b,
    'status', v_row.status,
    'is_daily', v_row.is_daily,
    'audit_log', v_row.audit_log,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.referee_get_match_by_token(text) from public;
grant execute on function public.referee_get_match_by_token(text) to anon, authenticated;

revoke all on function public.referee_update_match_score(text, jsonb) from public;
grant execute on function public.referee_update_match_score(text, jsonb) to anon, authenticated;
