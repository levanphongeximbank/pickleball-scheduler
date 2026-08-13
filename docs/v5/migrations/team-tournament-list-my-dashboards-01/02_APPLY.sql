-- team-tournament-list-my-dashboards-01 / 02_APPLY
-- LOCAL ONLY. Do not apply without Owner GO.
-- Server-auth "Giải của tôi" list with Dashboard visibility parity.
-- Identity: auth.uid() → athletes.id only (no profiles.player_id).

create or replace function public.team_tournament_list_my_dashboards()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_player_id text := null;
  v_user_tenant text := null;
  v_can_manage boolean := false;
  v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'tournaments', '[]'::jsonb);
  end if;

  v_can_manage := public.team_tournament_can_manage();
  v_user_tenant := public.user_venue_id();

  if not public.is_super_admin() and v_user_tenant is null then
    return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'tournaments', '[]'::jsonb);
  end if;

  select a.id::text
    into v_player_id
  from public.athletes a
  where a.user_id = auth.uid()
  order by a.updated_at desc nulls last, a.created_at desc nulls last
  limit 1;

  with base as (
    select
      tt.id as team_tournament_uuid,
      coalesce(nullif(trim(tt.tournament_id), ''), tt.id::text) as canonical_id,
      tt.name,
      tt.status,
      tt.club_id,
      tt.tenant_id,
      tt.updated_at,
      (
        v_can_manage
        and (
          public.is_super_admin()
          or tt.tenant_id = v_user_tenant
        )
      ) as is_organizer,
      (
        v_player_id is not null
        and exists (
          select 1
          from public.team_tournament_teams t
          where t.team_tournament_id = tt.id
            and (
              t.captain_player_id = v_player_id
              or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
            )
        )
      ) as is_captain_or_deputy,
      (
        to_regclass('public.referee_assignments') is not null
        and exists (
          select 1
          from public.referee_assignments ra
          where ra.tenant_id = tt.tenant_id
            and ra.tournament_id = coalesce(nullif(trim(tt.tournament_id), ''), tt.id::text)
            and ra.referee_user_id = auth.uid()
            and ra.revoked_at is null
        )
      ) as is_assigned_referee,
      (
        v_player_id is not null
        and exists (
          select 1
          from public.team_tournament_teams t
          left join public.team_tournament_team_members mb on mb.team_id = t.id
          where t.team_tournament_id = tt.id
            and (
              mb.player_id = v_player_id
              or t.captain_player_id = v_player_id
              or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
            )
        )
      ) as is_participant
    from public.team_tournaments tt
    where public.is_super_admin()
       or tt.tenant_id = v_user_tenant
  ),
  gated as (
    select *
    from base b
    where public.team_tournament_can_view_dashboard(
      b.status,
      b.is_organizer,
      b.is_captain_or_deputy,
      b.is_assigned_referee
    )
  ),
  enriched as (
    select
      g.*,
      (
        select jsonb_build_object(
          'id', t.external_team_id,
          'name', t.name
        )
        from public.team_tournament_teams t
        left join public.team_tournament_team_members mb on mb.team_id = t.id
        where t.team_tournament_id = g.team_tournament_uuid
          and v_player_id is not null
          and (
            mb.player_id = v_player_id
            or t.captain_player_id = v_player_id
            or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
          )
        order by
          case
            when t.captain_player_id = v_player_id then 0
            when coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id] then 1
            else 2
          end,
          t.created_at
        limit 1
      ) as my_team,
      (
        select t.external_team_id
        from public.team_tournament_teams t
        where t.team_tournament_id = g.team_tournament_uuid
          and v_player_id is not null
          and (
            t.captain_player_id = v_player_id
            or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
          )
        limit 1
      ) as captain_team_id
    from gated g
  ),
  projected as (
    select
      jsonb_build_object(
        'id', e.canonical_id,
        'teamDomainId', e.team_tournament_uuid::text,
        'name', e.name,
        'status', e.status,
        'clubId', e.club_id,
        'tenantId', e.tenant_id,
        'roles', (
          select coalesce(jsonb_agg(role order by role), '[]'::jsonb)
          from (
            select 'organizer' as role where e.is_organizer
            union all
            select 'captain' where e.is_captain_or_deputy
            union all
            select 'referee' where e.is_assigned_referee
            union all
            select 'participant' where e.is_participant
            union all
            select 'viewer'
              where not e.is_organizer
                and not e.is_captain_or_deputy
                and not e.is_assigned_referee
                and not e.is_participant
          ) roles
        ),
        'myTeam', e.my_team,
        'openTaskCount', case
          when e.captain_team_id is null then 0
          else (
            select count(*)::int
            from public.team_tournament_matchups m
            left join public.team_tournament_lineups l
              on l.matchup_id = m.id
             and l.team_external_id = e.captain_team_id
            where m.team_tournament_id = e.team_tournament_uuid
              and (m.team_a_id = e.captain_team_id or m.team_b_id = e.captain_team_id)
              and lower(coalesce(m.status, '')) <> 'completed'
              and (
                l.id is null
                or lower(coalesce(l.status, '')) in ('', 'draft', 'lineup_open', 'waiting')
              )
          )
        end,
        'nextMatchup', (
          select jsonb_build_object(
            'id', m.external_matchup_id,
            'status', m.status,
            'teamAId', m.team_a_id,
            'teamBId', m.team_b_id,
            'scheduledAt', m.scheduled_at
          )
          from public.team_tournament_matchups m
          where m.team_tournament_id = e.team_tournament_uuid
            and lower(coalesce(m.status, '')) <> 'completed'
            and (
              e.my_team is null
              or m.team_a_id = e.my_team->>'id'
              or m.team_b_id = e.my_team->>'id'
              or e.is_assigned_referee
              or e.is_organizer
            )
          order by m.scheduled_at nulls last, m.created_at
          limit 1
        ),
        'href', '/tournaments/' || e.canonical_id,
        'captainPortalHref', case
          when e.captain_team_id is null then null
          else '/team-portal/' || e.canonical_id || '?club=' || coalesce(e.club_id, '')
        end,
        'refereeHref', case
          when not e.is_assigned_referee then null
          else '/team-referee/' || e.canonical_id
        end
      ) as item,
      e.updated_at
    from enriched e
  )
  select coalesce(jsonb_agg(p.item order by p.updated_at desc), '[]'::jsonb)
    into v_rows
  from projected p;

  return jsonb_build_object('ok', true, 'tournaments', coalesce(v_rows, '[]'::jsonb));
end;
$$;

revoke all on function public.team_tournament_list_my_dashboards() from public;
revoke all on function public.team_tournament_list_my_dashboards() from anon;
grant execute on function public.team_tournament_list_my_dashboards() to authenticated;
