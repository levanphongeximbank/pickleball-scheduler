-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-post417-regression-closure-01
-- Restores #417 header-only team_tournament_create.
-- Does not delete already-seeded discipline rows.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.team_tournament_commit_pairing(text, jsonb, jsonb, jsonb);
drop function if exists public.team_tournament_seed_mlp_disciplines(public.team_tournaments);
drop function if exists public.team_tournament_initial_setup_team_data(public.team_tournaments);
drop function if exists public.team_tournament_merge_mlp_initial_settings(jsonb);

create or replace function public.team_tournament_create(
  p_tenant_id text,
  p_club_id text,
  p_name text,
  p_season_id text default null,
  p_league_id text default null,
  p_created_by text default null,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_name text := coalesce(nullif(trim(p_name), ''), 'Giải đồng đội');
  v_created_by text := nullif(trim(coalesce(p_created_by, '')), '');
  v_settings jsonb := coalesce(p_settings, '{}'::jsonb);
  v_idempotency text := nullif(trim(coalesce(p_settings->>'idempotencyKey', '')), '');
  v_row public.canonical_tournaments%rowtype;
  v_header_exists boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  perform public.team_tournament_assert_tenant(p_tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_idempotency is not null then
    perform pg_advisory_xact_lock(
      hashtext(p_tenant_id || ':' || p_club_id),
      hashtext(v_idempotency)
    );
    select * into v_row
    from public.canonical_tournaments t
    where t.tenant_id = p_tenant_id
      and t.club_id = p_club_id
      and t.payload->>'idempotencyKey' = v_idempotency
    limit 1;
    if found then
      select exists (
        select 1
        from public.team_tournaments tt
        where tt.tenant_id = p_tenant_id
          and tt.club_id = p_club_id
          and tt.tournament_id = v_row.id::text
      ) into v_header_exists;
      if not v_header_exists then
        return jsonb_build_object('ok', false, 'code', 'CREATE_INCONSISTENT');
      end if;
      return jsonb_build_object(
        'ok', true,
        'replayed', true,
        'tournament', jsonb_build_object(
          'id', v_row.id::text,
          'canonicalId', v_row.id::text,
          'teamDomainId', coalesce(v_row.payload->>'teamDomainId', v_row.id::text),
          'clubId', v_row.club_id,
          'tenantId', v_row.tenant_id,
          'name', v_row.name,
          'mode', 'team_tournament',
          'status', v_row.status,
          'createdBy', v_row.payload->>'createdBy',
          'ownerPlayerId', v_row.payload->>'ownerPlayerId',
          'settings', coalesce(v_row.payload->'settings', v_settings)
        )
      );
    end if;
  end if;

  insert into public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, season_id, league_id, payload, engine_v4
  ) values (
    v_id,
    p_tenant_id,
    p_club_id,
    v_id::text,
    v_name,
    'team_tournament',
    'draft',
    nullif(trim(coalesce(p_season_id, '')), ''),
    nullif(trim(coalesce(p_league_id, '')), ''),
    jsonb_build_object(
      'id', v_id::text,
      'mode', 'team_tournament',
      'status', 'draft',
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'teamDomainId', v_id::text,
      'idempotencyKey', v_idempotency,
      'settings', v_settings
    ),
    '{}'::jsonb
  )
  returning * into v_row;

  insert into public.team_tournaments (
    tenant_id, club_id, tournament_id, name, status, settings, created_by, updated_by
  ) values (
    p_tenant_id,
    p_club_id,
    v_id::text,
    v_name,
    'draft',
    v_settings,
    auth.uid(),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'tournament', jsonb_build_object(
      'id', v_id::text,
      'canonicalId', v_id::text,
      'teamDomainId', v_id::text,
      'clubId', p_club_id,
      'tenantId', p_tenant_id,
      'name', v_name,
      'mode', 'team_tournament',
      'status', 'draft',
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'settings', v_settings
    )
  );
exception
  when others then
    if sqlerrm in ('access_denied: cross-tenant', 'TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', sqlerrm);
    end if;
    raise;
end;
$$;

revoke all on function public.team_tournament_create(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.team_tournament_create(text, text, text, text, text, text, jsonb) to authenticated;
