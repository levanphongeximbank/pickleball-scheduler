-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-canonical-dashboard-lifecycle-01
-- Restores list_mine to the cutover body. Drops new RPCs.
-- Does not delete canonical/team tournament rows.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.team_tournament_get_dashboard(text);
drop function if exists public.team_tournament_list_my_referee_assignments(text);
drop function if exists public.team_tournament_ensure_canonical(text, text, text, text, text);
drop function if exists public.team_tournament_create(text, text, text, text, text, text, jsonb);
drop function if exists public.team_tournament_status_is_athlete_visible(text);

create or replace function public.canonical_tournament_list_mine(
  p_tenant_id text,
  p_club_id text,
  p_player_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rows jsonb;
  pid text := nullif(trim(coalesce(p_player_id, '')), '');
begin
  perform public.canonical_tournament_assert_tenant(p_tenant_id);
  perform public.canonical_tournament_assert_permission('tournament.view');
  if pid is null then
    return jsonb_build_object('ok', false, 'code', 'TOURNAMENT_FORBIDDEN', 'tournaments', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc), '[]'::jsonb)
    into rows
  from public.canonical_tournaments t
  where t.tenant_id = p_tenant_id
    and t.club_id = p_club_id
    and public.canonical_tournament_is_mine(t.payload, pid);

  return jsonb_build_object('ok', true, 'tournaments', rows);
exception
  when others then
    if sqlerrm in ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', sqlerrm, 'tournaments', '[]'::jsonb);
    end if;
    raise;
end;
$$;
