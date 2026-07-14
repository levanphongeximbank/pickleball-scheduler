-- ─── Publish readiness helper ───
create or replace function public.team_tournament_matchup_publish_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_lineup_ops jsonb;
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_can_publish boolean := false;
  v_block_code text := null;
  v_block_message text := null;
begin
  if p_matchup.status in ('published', 'in_progress', 'completed') then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'already_published',
      'blockMessage', 'Matchup đã được công bố.',
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version,
      'publishedAt', p_matchup.updated_at
    );
  end if;

  if p_matchup.status <> 'locked' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'matchup_not_locked',
      'blockMessage', 'Matchup chưa khóa — không thể công bố.',
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = p_matchup.id
    and l.team_external_id = p_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = p_matchup.id
    and l.team_external_id = p_matchup.team_b_id;

  if v_lineup_a.id is null or v_lineup_b.id is null then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'lineup_missing',
      'blockMessage', 'Thiếu đội hình một hoặc cả hai đội.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'teamAId', p_matchup.team_a_id,
      'teamBId', p_matchup.team_b_id
    );
  end if;

  if v_lineup_a.status <> 'locked' or v_lineup_b.status <> 'locked' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'lineup_not_locked',
      'blockMessage', 'Cả hai đội hình phải ở trạng thái locked trước khi công bố.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'lineupAStatus', v_lineup_a.status,
      'lineupBStatus', v_lineup_b.status
    );
  end if;

  if coalesce(v_lineup_a.audit_note, '') like 'tt2d:manual_pending%'
     or coalesce(v_lineup_b.audit_note, '') like 'tt2d:manual_pending%' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'manual_pending',
      'blockMessage', 'Còn đội hình chờ xử lý thủ công (manual_pending).',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version
    );
  end if;

  v_lineup_ops := public.team_tournament_matchup_lineup_ops(p_header, p_matchup, p_now);

  if jsonb_array_length(coalesce(v_lineup_ops->'unhandledMissingTeamIds', '[]'::jsonb)) > 0 then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'missing_policy_unresolved',
      'blockMessage', 'Chính sách thiếu lineup chưa được xử lý.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'unhandledMissingTeamIds', v_lineup_ops->'unhandledMissingTeamIds',
      'lineupOps', v_lineup_ops
    );
  end if;

  v_can_publish := true;

  return jsonb_build_object(
    'canPublish', v_can_publish,
    'blockCode', v_block_code,
    'blockMessage', v_block_message,
    'matchupStatus', p_matchup.status,
    'matchupVersion', p_matchup.version,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'teamAId', p_matchup.team_a_id,
    'teamBId', p_matchup.team_b_id,
    'lineupAStatus', v_lineup_a.status,
    'lineupBStatus', v_lineup_b.status,
    'lineupOps', v_lineup_ops
  );
end;
$$;

