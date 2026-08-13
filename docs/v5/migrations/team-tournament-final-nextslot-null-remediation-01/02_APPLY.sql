-- team-tournament-final-nextslot-null-remediation-01 / 02_APPLY
-- LOCAL ONLY. Apply once after Owner GO.
-- Forward-only. Does NOT re-run final-progression-referee / scenario-b-ko / close-uuid.
-- Fixes NULL nextSlot fallback (SQL NULL NOT IN is not TRUE).
-- Reconciles partially filled Final from canonical predecessor winners.

-- Canonical slot resolver. Semantics match src/.../teamKnockoutEngine.js
-- resolveKnockoutNextSlot. Valid A/B wins; NULL/blank/invalid → matchNumberInRound
-- (1 → A, 2 → B). Use IS DISTINCT FROM — never `NOT IN` on nullable text.

create or replace function public.team_tournament_resolve_knockout_next_slot(p_meta jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_slot text;
  v_n integer;
begin
  v_slot := nullif(btrim(upper(coalesce(p_meta->>'nextSlot', ''))), '');
  if v_slot is not distinct from 'A' or v_slot is not distinct from 'B' then
    return v_slot;
  end if;

  begin
    v_n := (nullif(btrim(coalesce(p_meta->>'matchNumberInRound', '')), ''))::int;
  exception when others then
    v_n := null;
  end;

  if v_n = 2 then
    return 'B';
  end if;
  return 'A';
end;
$$;

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

  v_slot := public.team_tournament_resolve_knockout_next_slot(v_src.schedule_meta);

  -- Persist resolved slot onto historical rows that dropped nextSlot.
  update public.team_tournament_matchups
     set schedule_meta = coalesce(schedule_meta, '{}'::jsonb)
       || jsonb_build_object('nextSlot', v_slot),
         updated_at = now()
   where id = v_src.id
     and coalesce(schedule_meta->>'nextSlot', '') is distinct from v_slot;

  select * into v_next
  from public.team_tournament_matchups
  where team_tournament_id = v_src.team_tournament_id
    and external_matchup_id = v_next_id
  for update;

  if v_next.id is null then
    return;
  end if;

  if v_slot = 'B' then
    if coalesce(v_next.team_b_id, '') is not distinct from v_winner then
      return;
    end if;
    update public.team_tournament_matchups
       set team_b_id = v_winner,
           updated_at = now()
     where id = v_next.id;
  else
    if coalesce(v_next.team_a_id, '') is not distinct from v_winner then
      return;
    end if;
    update public.team_tournament_matchups
       set team_a_id = v_winner,
           updated_at = now()
     where id = v_next.id;
  end if;
end;
$$;

-- Reconcile a next-round placeholder from ALL completed predecessors.
-- Overwrites a wrong partial fill (Owner B team_a occupied by SF2 winner).
create or replace function public.team_tournament_reconcile_knockout_progression(
  p_team_tournament_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next public.team_tournament_matchups;
  v_pred record;
  v_slot text;
  v_winner text;
  v_team_a text;
  v_team_b text;
  v_count_a int;
  v_count_b int;
  v_pred_count int;
  v_n int;
begin
  for v_next in
    select n.*
    from public.team_tournament_matchups n
    where lower(coalesce(n.schedule_meta->>'stage', '')) = 'knockout'
      and (p_team_tournament_id is null or n.team_tournament_id = p_team_tournament_id)
      and exists (
        select 1
        from public.team_tournament_matchups p
        where p.team_tournament_id = n.team_tournament_id
          and lower(coalesce(p.schedule_meta->>'stage', '')) = 'knockout'
          and lower(coalesce(p.status, '')) = 'completed'
          and nullif(btrim(coalesce(p.result->>'winnerTeamId', '')), '') is not null
          and nullif(btrim(coalesce(p.schedule_meta->>'nextMatchupId', '')), '')
            = n.external_matchup_id
      )
    for update of n
  loop
    v_team_a := null;
    v_team_b := null;
    v_count_a := 0;
    v_count_b := 0;
    v_pred_count := 0;

    for v_pred in
      select p.id, p.schedule_meta, p.result, p.external_matchup_id
      from public.team_tournament_matchups p
      where p.team_tournament_id = v_next.team_tournament_id
        and lower(coalesce(p.schedule_meta->>'stage', '')) = 'knockout'
        and lower(coalesce(p.status, '')) = 'completed'
        and nullif(btrim(coalesce(p.result->>'winnerTeamId', '')), '') is not null
        and nullif(btrim(coalesce(p.schedule_meta->>'nextMatchupId', '')), '')
          = v_next.external_matchup_id
      order by coalesce((p.schedule_meta->>'matchNumberInRound')::int, 0), p.external_matchup_id
    loop
      v_pred_count := v_pred_count + 1;
      v_slot := public.team_tournament_resolve_knockout_next_slot(v_pred.schedule_meta);
      v_winner := nullif(btrim(coalesce(v_pred.result->>'winnerTeamId', '')), '');
      if v_slot = 'A' then
        v_count_a := v_count_a + 1;
        v_team_a := v_winner;
      else
        v_count_b := v_count_b + 1;
        v_team_b := v_winner;
      end if;

      update public.team_tournament_matchups
         set schedule_meta = coalesce(schedule_meta, '{}'::jsonb)
           || jsonb_build_object('nextSlot', v_slot),
             updated_at = now()
       where id = v_pred.id
         and coalesce(schedule_meta->>'nextSlot', '') is distinct from v_slot;
    end loop;

    -- Two predecessors collapsed onto one slot (historical NULL nextSlot):
    -- assign by canonical matchNumberInRound order (1 → A, 2 → B).
    if v_pred_count >= 2 and (v_count_a = 0 or v_count_b = 0) then
      v_team_a := null;
      v_team_b := null;
      v_n := 0;
      for v_pred in
        select p.id, p.result, p.schedule_meta
        from public.team_tournament_matchups p
        where p.team_tournament_id = v_next.team_tournament_id
          and lower(coalesce(p.schedule_meta->>'stage', '')) = 'knockout'
          and lower(coalesce(p.status, '')) = 'completed'
          and nullif(btrim(coalesce(p.schedule_meta->>'nextMatchupId', '')), '')
            = v_next.external_matchup_id
        order by coalesce((p.schedule_meta->>'matchNumberInRound')::int, 0), p.external_matchup_id
      loop
        v_n := v_n + 1;
        v_winner := nullif(btrim(coalesce(v_pred.result->>'winnerTeamId', '')), '');
        v_slot := case when v_n = 1 then 'A' else 'B' end;
        if v_n = 1 then
          v_team_a := v_winner;
        elsif v_n = 2 then
          v_team_b := v_winner;
        end if;
        update public.team_tournament_matchups
           set schedule_meta = coalesce(schedule_meta, '{}'::jsonb)
             || jsonb_build_object('nextSlot', v_slot),
               updated_at = now()
         where id = v_pred.id
           and coalesce(schedule_meta->>'nextSlot', '') is distinct from v_slot;
      end loop;
    end if;

    update public.team_tournament_matchups
       set team_a_id = coalesce(v_team_a, team_a_id),
           team_b_id = coalesce(v_team_b, team_b_id),
           updated_at = now()
     where id = v_next.id
       and (
         coalesce(team_a_id, '') is distinct from coalesce(v_team_a, team_a_id, '')
         or coalesce(team_b_id, '') is distinct from coalesce(v_team_b, team_b_id, '')
       );
  end loop;
end;
$$;

revoke all on function public.team_tournament_resolve_knockout_next_slot(jsonb) from public, anon;
revoke all on function public.team_tournament_advance_knockout_winner(uuid) from public, anon;
revoke all on function public.team_tournament_reconcile_knockout_progression(uuid) from public, anon;

-- Idempotent historical reconcile (Owner B Final partial fill).
select public.team_tournament_reconcile_knockout_progression(null);
