-- team-tournament-scenario-b-final-progression-referee-01 / 02_APPLY
-- LOCAL ONLY. Apply once after Owner GO.
-- Forward-only. Does NOT re-run scenario-b-ko-lineup / close-uuid / lifecycle.
-- Does NOT drop referee unique constraint.

-- ═══════════════════════════════════════════════════════════════════
-- A. Persist nextSlot on matchups.replace (additive to Scenario B package)
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_replace_matchups(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prepare json;
  v_header public.team_tournaments;
  v_payload jsonb;
  v_envelope jsonb;
  v_item jsonb;
  v_sub jsonb;
  v_id text;
  v_team_a text;
  v_team_b text;
  v_new_version integer;
  v_match public.team_tournament_matchups;
  v_payload_ids text[];
begin
  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'matchups.replace', p_expected_version, p_idempotency_key);
  if not coalesce((v_prepare->>'ok')::boolean, false) then
    return v_prepare;
  end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select * into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';
  v_payload := v_envelope->'payload';

  if nullif(btrim(v_envelope->>'rulesVersion'), '') is null then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'rulesVersion is required.');
  end if;

  if exists (
    select 1
    from public.team_tournament_matchups m
    where m.team_tournament_id = v_header.id
      and (
        public.team_tournament_matchup_is_started(m)
        or public.team_tournament_matchup_has_confirmed_result(m.id)
      )
  ) and not coalesce((v_envelope->>'confirmDestructive')::boolean, false) then
    return json_build_object('ok', false, 'code', 'CONFIRM_DESTRUCTIVE_REQUIRED');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb)) x
    where (
      nullif(btrim(coalesce(x.value->>'teamAId', '')), '') is not null
      and not exists (
        select 1
        from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = nullif(btrim(coalesce(x.value->>'teamAId', '')), '')
      )
    ) or (
      nullif(btrim(coalesce(x.value->>'teamBId', '')), '') is not null
      and not exists (
        select 1
        from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = nullif(btrim(coalesce(x.value->>'teamBId', '')), '')
      )
    )
  ) then
    return json_build_object(
      'ok', false,
      'code', 'UNKNOWN_TEAM',
      'error', 'Đội trong lịch không tồn tại trên server.'
    );
  end if;

  v_payload_ids := '{}'::text[];

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb))
  loop
    v_id := coalesce(nullif(v_item->>'id', ''), gen_random_uuid()::text);
    v_payload_ids := array_append(v_payload_ids, v_id);
    v_team_a := coalesce(nullif(btrim(coalesce(v_item->>'teamAId', '')), ''), '');
    v_team_b := coalesce(nullif(btrim(coalesce(v_item->>'teamBId', '')), ''), '');

    update public.team_tournament_matchups
       set team_a_id = v_team_a,
           team_b_id = v_team_b,
           scheduled_at = nullif(v_item->>'scheduledAt', '')::timestamptz,
           lineup_lock_at = nullif(v_item->>'lineupLockAt', '')::timestamptz,
           court_label = nullif(v_item->>'courtLabel', ''),
           status = coalesce(v_item->>'status', status, 'lineup_open'),
           schedule_meta = coalesce(v_item->'scheduleMeta', '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object(
                  'groupId', v_item->>'groupId',
                  'roundNumber', v_item->'roundNumber',
                  'matchNumberInRound', v_item->'matchNumberInRound',
                  'stage', v_item->>'stage',
                  'nextMatchupId', v_item->>'nextMatchupId',
                  'nextSlot', v_item->>'nextSlot',
                  'competitionStage', v_item->>'competitionStage',
                  'bracketRoundLabel', v_item->>'bracketRoundLabel'
                )),
           updated_at = now(),
           updated_by = auth.uid()
     where team_tournament_id = v_header.id
       and external_matchup_id = v_id
    returning * into v_match;

    if not found then
      insert into public.team_tournament_matchups(
        tenant_id, tournament_id, team_tournament_id, external_matchup_id,
        team_a_id, team_b_id, scheduled_at, lineup_lock_at, court_label, status,
        schedule_meta, created_by, updated_by
      ) values (
        v_header.tenant_id, p_tournament_id, v_header.id, v_id,
        v_team_a, v_team_b,
        nullif(v_item->>'scheduledAt', '')::timestamptz,
        nullif(v_item->>'lineupLockAt', '')::timestamptz,
        nullif(v_item->>'courtLabel', ''),
        coalesce(v_item->>'status', 'lineup_open'),
        coalesce(v_item->'scheduleMeta', '{}'::jsonb)
          || jsonb_strip_nulls(jsonb_build_object(
               'groupId', v_item->>'groupId',
               'roundNumber', v_item->'roundNumber',
               'matchNumberInRound', v_item->'matchNumberInRound',
               'stage', v_item->>'stage',
               'nextMatchupId', v_item->>'nextMatchupId',
               'nextSlot', v_item->>'nextSlot',
               'competitionStage', v_item->>'competitionStage',
               'bracketRoundLabel', v_item->>'bracketRoundLabel'
             )),
        auth.uid(), auth.uid()
      ) returning * into v_match;
    end if;

    delete from public.team_tournament_sub_matches where matchup_id = v_match.id;
    for v_sub in select value from jsonb_array_elements(coalesce(v_item->'subMatches', '[]'::jsonb))
    loop
      if not exists (
        select 1
        from public.team_tournament_disciplines d
        where d.team_tournament_id = v_header.id
          and d.external_discipline_id = coalesce(v_sub->>'disciplineId', v_sub->>'disciplineExternalId')
      ) then
        return json_build_object(
          'ok', false,
          'code', 'UNKNOWN_DISCIPLINE',
          'error', 'Nội dung (discipline) không khớp dữ liệu giải.'
        );
      end if;
      insert into public.team_tournament_sub_matches(
        tenant_id, tournament_id, matchup_id, external_sub_match_id,
        discipline_external_id, sort_order
      ) values (
        v_header.tenant_id, p_tournament_id, v_match.id,
        coalesce(v_sub->>'id', gen_random_uuid()::text),
        coalesce(v_sub->>'disciplineId', v_sub->>'disciplineExternalId'),
        coalesce((v_sub->>'sortOrder')::int, 1)
      );
    end loop;
  end loop;

  delete from public.team_tournament_matchups m
   where m.team_tournament_id = v_header.id
     and not (m.external_matchup_id = any (v_payload_ids));

  if exists (
    select 1
    from public.team_tournament_matchups a
    join public.team_tournament_matchups b
      on a.team_tournament_id = b.team_tournament_id
     and a.id < b.id
     and a.court_label = b.court_label
     and a.scheduled_at = b.scheduled_at
    where a.team_tournament_id = v_header.id
      and a.court_label is not null
      and a.scheduled_at is not null
  ) then
    return json_build_object(
      'ok', false,
      'code', 'COURT_CONFLICT',
      'error', 'Trùng sân / giờ thi đấu — chọn khung giờ hoặc sân khác.'
    );
  end if;

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);
  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid
  );
end;
$$;

revoke all on function public.team_tournament_replace_matchups(text, jsonb, integer, text)
  from public, anon;
grant execute on function public.team_tournament_replace_matchups(text, jsonb, integer, text)
  to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- B. Automatic KO advancement from canonical persisted results
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_advance_knockout_winner(p_matchup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.team_tournament_matchups;
  v_next public.team_tournament_matchups;
  v_winner text;
  v_next_id text;
  v_slot text;
  v_match_n integer;
begin
  select * into v_src
  from public.team_tournament_matchups
  where id = p_matchup_id
  for update;

  if v_src.id is null then
    return;
  end if;

  if lower(coalesce(v_src.schedule_meta->>'stage', '')) <> 'knockout' then
    return;
  end if;

  if lower(coalesce(v_src.status, '')) <> 'completed' then
    return;
  end if;

  v_winner := nullif(btrim(coalesce(v_src.result->>'winnerTeamId', '')), '');
  if v_winner is null then
    return;
  end if;

  v_next_id := nullif(btrim(coalesce(v_src.schedule_meta->>'nextMatchupId', '')), '');
  if v_next_id is null then
    return;
  end if;

  v_slot := nullif(btrim(coalesce(v_src.schedule_meta->>'nextSlot', '')), '');
  if v_slot not in ('A', 'B') then
    begin
      v_match_n := coalesce((v_src.schedule_meta->>'matchNumberInRound')::int, 1);
    exception when others then
      v_match_n := 1;
    end;
    v_slot := case when v_match_n = 2 then 'B' else 'A' end;
  end if;

  select * into v_next
  from public.team_tournament_matchups
  where team_tournament_id = v_src.team_tournament_id
    and external_matchup_id = v_next_id
  for update;

  if v_next.id is null then
    return;
  end if;

  if v_slot = 'B' then
    if coalesce(v_next.team_b_id, '') = v_winner then
      return;
    end if;
    update public.team_tournament_matchups
       set team_b_id = v_winner,
           updated_at = now()
     where id = v_next.id;
  else
    if coalesce(v_next.team_a_id, '') = v_winner then
      return;
    end if;
    update public.team_tournament_matchups
       set team_a_id = v_winner,
           updated_at = now()
     where id = v_next.id;
  end if;
end;
$$;

create or replace function public.team_tournament_advance_knockout_winner_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(NEW.status, '')) = 'completed'
     and lower(coalesce(NEW.schedule_meta->>'stage', '')) = 'knockout' then
    perform public.team_tournament_advance_knockout_winner(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists team_tournament_advance_knockout_winner_trg
  on public.team_tournament_matchups;

create trigger team_tournament_advance_knockout_winner_trg
  after insert or update of status, result, schedule_meta
  on public.team_tournament_matchups
  for each row
  execute function public.team_tournament_advance_knockout_winner_trg();

-- Backfill already-completed KO rows (Owner B SFs completed before this trigger).
do $$
declare
  r record;
begin
  for r in
    select m.id
    from public.team_tournament_matchups m
    where lower(coalesce(m.status, '')) = 'completed'
      and lower(coalesce(m.schedule_meta->>'stage', '')) = 'knockout'
      and nullif(btrim(coalesce(m.result->>'winnerTeamId', '')), '') is not null
      and nullif(btrim(coalesce(m.schedule_meta->>'nextMatchupId', '')), '') is not null
  loop
    perform public.team_tournament_advance_knockout_winner(r.id);
  end loop;
end $$;

revoke all on function public.team_tournament_advance_knockout_winner(uuid) from public, anon;
revoke all on function public.team_tournament_advance_knockout_winner_trg() from public, anon;

-- ═══════════════════════════════════════════════════════════════════
-- C. Referee assign: idempotent same-ref, atomic supersede, no unique leak
-- Unique constraint KEEP: (tenant_id, tournament_id, match_id, role, referee_user_id)
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_create_referee_assignment(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_referee_user_id uuid,
  p_expires_at timestamptz default null,
  p_activate boolean default true,
  p_idempotency_key text default null,
  p_reason text default 'tt5d_assign'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_profile public.profiles;
  v_existing public.referee_assignments;
  v_row public.referee_assignments;
  v_status text;
  v_cmd json;
  v_effective text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'error', 'Phiên đăng nhập hết hạn — đăng nhập lại.');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không đủ quyền thực hiện thao tác này.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy giải hoặc tài nguyên liên quan.');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', 'Từ chối truy cập ngoài tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'create_referee_assignment', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'refereeUserId', p_referee_user_id,
      'expiresAt', p_expires_at,
      'reason', p_reason
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy trận đấu.');
  end if;

  if nullif(btrim(coalesce(v_matchup.team_a_id, '')), '') is null
     or nullif(btrim(coalesce(v_matchup.team_b_id, '')), '') is null then
    return json_build_object(
      'ok', false,
      'code', 'MATCHUP_TEAMS_UNRESOLVED',
      'error', 'Trận chưa đủ hai đội (placeholder knockout). Không gán trọng tài.'
    );
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id
    and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy trận con.');
  end if;

  select * into v_profile from public.profiles where id = p_referee_user_id;
  if v_profile.id is null then
    return json_build_object('ok', false, 'code', 'REFEREE_NOT_FOUND', 'error', 'Không tìm thấy hồ sơ trọng tài (profiles id).');
  end if;

  v_status := case when coalesce(p_activate, true) then 'active' else 'pending' end;

  -- Atomic supersede: revoke other live assignments on the same canonical key prefix.
  update public.referee_assignments
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = auth.uid(),
         revoke_reason = coalesce(nullif(btrim(p_reason), ''), 'tt5d_supersede'),
         version = version + 1,
         updated_at = now()
   where tenant_id = v_header.tenant_id
     and tournament_id = v_header.tournament_id
     and match_id = v_sub_match.external_sub_match_id
     and role = 'REFEREE'
     and referee_user_id is distinct from p_referee_user_id
     and public.referee_v5_assignment_effective_status(status, expires_at, revoked_at)
       in ('pending', 'active');

  select * into v_existing
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and ra.match_id = v_sub_match.external_sub_match_id
    and ra.referee_user_id = p_referee_user_id
    and ra.role = 'REFEREE'
  for update;

  if v_existing.id is not null then
    v_effective := public.referee_v5_assignment_effective_status(
      v_existing.status, v_existing.expires_at, v_existing.revoked_at
    );
    if v_effective in ('pending', 'active') then
      return json_build_object(
        'ok', true,
        'replayed', true,
        'assignmentId', v_existing.id,
        'status', v_effective,
        'version', v_existing.version
      );
    end if;

    update public.referee_assignments set
      status = v_status,
      revoked_at = null,
      revoked_by = null,
      revoke_reason = null,
      assigned_by = auth.uid(),
      assigned_at = now(),
      expires_at = p_expires_at,
      external_matchup_id = v_matchup.external_matchup_id,
      external_sub_match_id = v_sub_match.external_sub_match_id,
      matchup_id = v_matchup.id,
      sub_match_id = v_sub_match.id,
      referee_display_name = coalesce(v_profile.display_name, v_profile.email, 'Referee'),
      version = version + 1,
      updated_at = now()
    where id = v_existing.id
    returning * into v_row;

    perform public.team_tournament_write_audit(
      v_header.tenant_id, v_header.tournament_id,
      'team.referee_v5.assignment_reactivated', v_sub_match.external_sub_match_id,
      jsonb_build_object(
        'assignmentId', v_row.id,
        'refereeUserId', p_referee_user_id,
        'status', v_status,
        'version', v_row.version
      )
    );

    return json_build_object(
      'ok', true,
      'replayed', false,
      'reactivated', true,
      'assignmentId', v_row.id,
      'refereeMatchId', v_row.match_id,
      'status', v_status,
      'version', v_row.version,
      'expiresAt', v_row.expires_at
    );
  end if;

  begin
    insert into public.referee_assignments (
      tenant_id, tournament_id, match_id,
      external_matchup_id, external_sub_match_id,
      matchup_id, sub_match_id,
      referee_user_id, referee_display_name,
      role, status, assigned_by, assigned_at, expires_at, version
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_sub_match.external_sub_match_id,
      v_matchup.external_matchup_id, v_sub_match.external_sub_match_id,
      v_matchup.id, v_sub_match.id,
      p_referee_user_id, coalesce(v_profile.display_name, v_profile.email, 'Referee'),
      'REFEREE', v_status, auth.uid(), now(), p_expires_at, 1
    )
    returning * into v_row;
  exception when unique_violation then
    select * into v_existing
    from public.referee_assignments ra
    where ra.tenant_id = v_header.tenant_id
      and ra.tournament_id = v_header.tournament_id
      and ra.match_id = v_sub_match.external_sub_match_id
      and ra.referee_user_id = p_referee_user_id
      and ra.role = 'REFEREE';
    if v_existing.id is not null then
      return json_build_object(
        'ok', true,
        'replayed', true,
        'assignmentId', v_existing.id,
        'status', public.referee_v5_assignment_effective_status(
          v_existing.status, v_existing.expires_at, v_existing.revoked_at
        ),
        'version', v_existing.version
      );
    end if;
    return json_build_object(
      'ok', false,
      'code', 'REFEREE_ASSIGNMENT_CONFLICT',
      'error', 'Trọng tài này đã được gán cho trận. Tải lại danh sách — không tạo assignment trùng.'
    );
  end;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.assignment_created', v_sub_match.external_sub_match_id,
    jsonb_build_object(
      'assignmentId', v_row.id,
      'refereeUserId', p_referee_user_id,
      'status', v_status,
      'expiresAt', p_expires_at,
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'version', v_row.version
    )
  );

  return json_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'refereeMatchId', v_row.match_id,
    'status', v_status,
    'version', v_row.version,
    'expiresAt', v_row.expires_at
  );
end;
$$;

revoke all on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  from public, anon;
grant execute on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  to authenticated;
