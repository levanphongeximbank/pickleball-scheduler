-- team-tournament-staging-acceptance-remediation-01 / 02_APPLY
-- LOCAL PACKAGE ONLY. Do not apply without Owner GO.
-- A) canonical + header name sync (server-authoritative, header PK independent)
-- B) opaque Team Tournament pairing runtime (no secret rule disclosure)

-- ═══════════════════════════════════════════════════════════════════
-- A. Display-name sync
-- Identity: canonical_tournaments.id = team_tournaments.tournament_id
-- Header PK (team_tournaments.id) stays independent of canonical id.
-- Readers after sync: dashboard/list use header.name; setup/F5 use canonical.name.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_rename(
  p_tournament_id text,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_canonical public.canonical_tournaments%rowtype;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_domain text := nullif(trim(coalesce(p_tournament_id, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if v_domain is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  if v_name is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  v_header := public.team_tournament_resolve_header(v_domain);
  if v_header.id is null then
    select * into v_canonical
    from public.canonical_tournaments t
    where t.id::text = v_domain
       or t.external_key = v_domain
    limit 1;
    if found then
      v_header := public.team_tournament_resolve_header(
        coalesce(v_canonical.payload->>'teamDomainId', v_canonical.external_key, v_canonical.id::text)
      );
    end if;
  end if;
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_canonical
  from public.canonical_tournaments t
  where t.id::text = v_header.tournament_id
    and t.tenant_id = v_header.tenant_id
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'CANONICAL_NOT_FOUND');
  end if;

  update public.team_tournaments
  set name = v_name, updated_at = now(), updated_by = auth.uid()
  where id = v_header.id
    and tournament_id = v_header.tournament_id
  returning * into v_header;

  update public.canonical_tournaments t
  set name = v_name, updated_at = now()
  where t.id::text = v_header.tournament_id
    and t.tenant_id = v_header.tenant_id
  returning * into v_canonical;

  return jsonb_build_object(
    'ok', true,
    'tournamentId', v_header.tournament_id,
    'canonicalId', v_canonical.id::text,
    'headerId', v_header.id::text,
    'name', v_canonical.name,
    'canonicalName', v_canonical.name,
    'headerName', v_header.name
  );
exception
  when others then
    if sqlerrm like 'access_denied%' or sqlerrm = 'TOURNAMENT_MISSING_TENANT' then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED');
    end if;
    raise;
end;
$$;

create or replace function public.team_tournament_trg_sync_name_from_header()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return NEW;
  end if;
  if NEW.tournament_id is null or nullif(trim(NEW.tournament_id), '') is null then
    return NEW;
  end if;
  update public.canonical_tournaments t
  set name = NEW.name, updated_at = now()
  where t.id::text = NEW.tournament_id
    and t.name is distinct from NEW.name;
  return NEW;
end;
$$;

create or replace function public.team_tournament_trg_sync_name_from_canonical()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return NEW;
  end if;
  if NEW.mode is distinct from 'team_tournament' then
    return NEW;
  end if;
  update public.team_tournaments tt
  set name = NEW.name, updated_at = now()
  where tt.tournament_id = NEW.id::text
    and tt.name is distinct from NEW.name;
  return NEW;
end;
$$;

drop trigger if exists trg_team_tournaments_sync_canonical_name on public.team_tournaments;
create trigger trg_team_tournaments_sync_canonical_name
  after update of name on public.team_tournaments
  for each row
  when (OLD.name is distinct from NEW.name)
  execute function public.team_tournament_trg_sync_name_from_header();

drop trigger if exists trg_canonical_tournaments_sync_team_header_name on public.canonical_tournaments;
create trigger trg_canonical_tournaments_sync_team_header_name
  after update of name on public.canonical_tournaments
  for each row
  when (NEW.mode = 'team_tournament' and OLD.name is distinct from NEW.name)
  execute function public.team_tournament_trg_sync_name_from_canonical();

revoke all on function public.team_tournament_rename(text, text) from public, anon;
grant execute on function public.team_tournament_rename(text, text) to authenticated;

revoke all on function public.team_tournament_trg_sync_name_from_header() from public, anon, authenticated;
revoke all on function public.team_tournament_trg_sync_name_from_canonical() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- B. Opaque pairing runtime
-- Organizer may run formation. Secret rules stay server-side.
-- Internal loader is NOT granted to authenticated/anon.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.private_pairing_load_active_rules_internal(
  p_tenant_id text,
  p_scope_type text,
  p_scope_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_set public.private_pairing_rule_sets%rowtype;
  v_rules jsonb := '[]'::jsonb;
begin
  if to_regclass('public.private_pairing_rule_sets') is null then
    return jsonb_build_object('ok', true, 'rule_set', null, 'rules', '[]'::jsonb);
  end if;

  select * into v_set
  from public.private_pairing_rule_sets s
  where s.tenant_id = p_tenant_id
    and s.scope_type = p_scope_type
    and s.scope_id is not distinct from p_scope_id
    and s.status = 'active'
  order by s.version desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'rule_set', null, 'rules', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'constraint_type', r.constraint_type,
    'severity', r.severity,
    'weight', r.weight,
    'primary_player_id', r.primary_player_id,
    'relation_mode', coalesce(r.relation_mode, 'ANY_OF'),
    'visibility', r.visibility,
    'start_at', r.start_at,
    'end_at', r.end_at,
    'target_player_ids', coalesce((
      select jsonb_agg(t.target_player_id order by t.target_player_id)
      from public.private_pairing_rule_targets t
      where t.rule_id = r.id
    ), '[]'::jsonb)
  ) order by r.created_at), '[]'::jsonb)
  into v_rules
  from public.private_pairing_rules r
  where r.rule_set_id = v_set.id
    and r.active = true
    and r.deleted_at is null
    and (r.start_at is null or r.start_at <= now())
    and (r.end_at is null or r.end_at >= now());

  return jsonb_build_object(
    'ok', true,
    'rule_set', jsonb_build_object(
      'id', v_set.id,
      'version', v_set.version,
      'scope_type', v_set.scope_type,
      'scope_id', v_set.scope_id
    ),
    'rules', coalesce(v_rules, '[]'::jsonb)
  );
end;
$$;

create or replace function public.team_tournament_pp_share_team(
  p_teams jsonb,
  p_a text,
  p_b text
)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_teams, '[]'::jsonb)) t
    where coalesce(t->'playerIds', t->'player_ids', '[]'::jsonb) @> to_jsonb(p_a)
      and coalesce(t->'playerIds', t->'player_ids', '[]'::jsonb) @> to_jsonb(p_b)
  );
$$;

create or replace function public.team_tournament_pp_relation(
  p_mode text,
  p_targets jsonb,
  p_teams jsonb,
  p_primary text,
  p_want_together boolean
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_target text;
  v_hits int := 0;
  v_n int := 0;
  v_together boolean;
begin
  if p_targets is null or jsonb_typeof(p_targets) <> 'array' then
    return p_want_together;
  end if;
  for v_target in select jsonb_array_elements_text(p_targets)
  loop
    v_n := v_n + 1;
    v_together := public.team_tournament_pp_share_team(p_teams, p_primary, v_target);
    if v_together then
      v_hits := v_hits + 1;
    end if;
  end loop;
  if v_n = 0 then
    return p_want_together;
  end if;
  if upper(coalesce(p_mode, 'ANY_OF')) = 'ALL_OF' then
    return v_hits = v_n;
  end if;
  return v_hits > 0;
end;
$$;

create or replace function public.team_tournament_pp_sanitize_teams(p_teams jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t->>'id',
      'name', t->>'name',
      'playerIds', coalesce(t->'playerIds', t->'player_ids', '[]'::jsonb),
      'avgLevel', t->'avgLevel',
      'seed', t->'seed',
      'captainPlayerId', t->>'captainPlayerId',
      'color', t->>'color',
      'logoUrl', t->>'logoUrl'
    ))
    from jsonb_array_elements(coalesce(p_teams, '[]'::jsonb)) t
  ), '[]'::jsonb);
$$;

create or replace function public.team_tournament_form_pairing_opaque(
  p_tournament_id text,
  p_candidates jsonb,
  p_competition_class text default 'INTERNAL',
  p_club_id text default null,
  p_seed text default null,
  p_request_id text default null,
  p_allowed_by_published_rules boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_class text := upper(nullif(trim(coalesce(p_competition_class, '')), ''));
  v_restricted boolean := false;
  v_loaded jsonb;
  v_rules jsonb := '[]'::jsonb;
  v_rule jsonb;
  v_rule_set jsonb := null;
  v_version text := '';
  v_cand jsonb;
  v_teams jsonb;
  v_hard_ok boolean;
  v_soft_score numeric;
  v_quality numeric;
  v_best jsonb := null;
  v_best_soft numeric := null;
  v_best_quality numeric := null;
  v_rejected int := 0;
  v_total int := 0;
  v_type text;
  v_severity text;
  v_primary text;
  v_targets jsonb;
  v_mode text;
  v_weight numeric;
  v_together boolean;
  v_request text := nullif(trim(coalesce(p_request_id, '')), '');
  v_club text := nullif(trim(coalesce(p_club_id, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_class is null then
    v_class := upper(nullif(trim(coalesce(
      v_header.settings->>'competitionClass',
      v_header.settings->>'competition_class',
      'INTERNAL'
    )), ''));
  end if;
  v_restricted := v_class in ('OFFICIAL', 'CERTIFIED', 'VPR_RANKED');
  if v_club is null then
    v_club := v_header.club_id;
  end if;
  if v_request is null then
    v_request := gen_random_uuid()::text;
  end if;

  v_loaded := public.private_pairing_load_active_rules_internal(
    v_header.tenant_id, 'TOURNAMENT', v_header.tournament_id
  );
  v_rules := coalesce(v_loaded->'rules', '[]'::jsonb);
  v_rule_set := v_loaded->'rule_set';

  if jsonb_array_length(v_rules) = 0 and not v_restricted and v_club is not null then
    v_loaded := public.private_pairing_load_active_rules_internal(
      v_header.tenant_id, 'CLUB', v_club
    );
    v_rules := coalesce(v_loaded->'rules', '[]'::jsonb);
    v_rule_set := v_loaded->'rule_set';
  end if;

  if v_restricted then
    for v_rule in select value from jsonb_array_elements(v_rules)
    loop
      v_type := v_rule->>'constraint_type';
      if v_type in ('prefer_partner', 'must_partner', 'prefer_opponent', 'must_opponent')
         and not (
           (v_rule->>'visibility') in ('disclosed', 'public')
           and p_allowed_by_published_rules is true
         )
      then
        return jsonb_build_object(
          'ok', false,
          'code', 'PAIRING_RULE_CONSTRAINT_UNSATISFIED',
          'requestId', v_request,
          'ruleSetVersion', coalesce(v_rule_set->>'version', ''),
          'algorithmVersion', 'tt-opaque-formation-v1'
        );
      end if;
    end loop;
  end if;

  v_version := coalesce(v_rule_set->>'version', '');

  if p_candidates is null or jsonb_typeof(p_candidates) <> 'array'
     or jsonb_array_length(p_candidates) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'PAIRING_SEARCH_LIMIT_REACHED',
      'requestId', v_request,
      'ruleSetVersion', v_version,
      'algorithmVersion', 'tt-opaque-formation-v1'
    );
  end if;

  for v_cand in select value from jsonb_array_elements(p_candidates)
  loop
    v_total := v_total + 1;
    v_teams := coalesce(v_cand->'teams', '[]'::jsonb);
    v_hard_ok := true;
    v_soft_score := 0;

    for v_rule in select value from jsonb_array_elements(v_rules)
    loop
      v_type := v_rule->>'constraint_type';
      if v_type not in (
        'prefer_partner', 'must_partner', 'avoid_partner', 'must_not_partner',
        'same_team', 'different_team'
      ) then
        continue;
      end if;
      v_severity := lower(coalesce(v_rule->>'severity', 'hard'));
      v_primary := v_rule->>'primary_player_id';
      v_targets := coalesce(v_rule->'target_player_ids', '[]'::jsonb);
      v_mode := coalesce(v_rule->>'relation_mode', 'ANY_OF');
      v_weight := coalesce((v_rule->>'weight')::numeric, 50);

      if v_type in ('must_partner', 'prefer_partner', 'same_team') then
        v_together := public.team_tournament_pp_relation(
          v_mode, v_targets, v_teams, v_primary, true
        );
        if v_severity = 'hard' then
          if not v_together then
            v_hard_ok := false;
          end if;
        else
          if v_together then
            v_soft_score := v_soft_score + v_weight;
          else
            v_soft_score := v_soft_score - round(v_weight * 0.35);
          end if;
        end if;
      elsif v_type in ('must_not_partner', 'avoid_partner', 'different_team') then
        v_together := public.team_tournament_pp_relation(
          v_mode, v_targets, v_teams, v_primary, false
        );
        if v_severity = 'hard' then
          if v_together then v_hard_ok := false; end if;
        else
          if v_together then
            v_soft_score := v_soft_score - v_weight;
          else
            v_soft_score := v_soft_score + round(v_weight * 0.25);
          end if;
        end if;
      end if;

      exit when v_hard_ok is false;
    end loop;

    if not v_hard_ok then
      v_rejected := v_rejected + 1;
      continue;
    end if;

    v_quality := coalesce((v_cand->>'formationQuality')::numeric, 0);
    if v_best is null
       or v_soft_score > v_best_soft
       or (v_soft_score = v_best_soft and v_quality > v_best_quality)
    then
      v_best := v_cand;
      v_best_soft := v_soft_score;
      v_best_quality := v_quality;
    end if;
  end loop;

  if v_best is null then
    return jsonb_build_object(
      'ok', false,
      'code', case
        when v_rejected = v_total then 'NO_FEASIBLE_PAIRING'
        else 'PAIRING_SEARCH_LIMIT_REACHED'
      end,
      'requestId', v_request,
      'ruleSetVersion', v_version,
      'algorithmVersion', 'tt-opaque-formation-v1',
      'candidateCount', v_total,
      'rejectedCandidateCount', v_rejected
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'teams', public.team_tournament_pp_sanitize_teams(coalesce(v_best->'teams', '[]'::jsonb)),
    'waitingPlayerIds', coalesce(v_best->'waitingPlayerIds', '[]'::jsonb),
    'warnings', coalesce(v_best->'warnings', '[]'::jsonb),
    'ruleSetVersion', v_version,
    'algorithmVersion', 'tt-opaque-formation-v1',
    'randomSeed', p_seed,
    'requestId', v_request,
    'enforced', jsonb_array_length(v_rules) > 0,
    'candidateCount', v_total,
    'rejectedCandidateCount', v_rejected,
    'constraintScore', v_best_soft
  );
exception
  when others then
    if sqlerrm like 'access_denied%' or sqlerrm = 'TOURNAMENT_MISSING_TENANT' then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED');
    end if;
    raise;
end;
$$;

revoke all on function public.private_pairing_load_active_rules_internal(text, text, text)
  from public, anon, authenticated;
revoke all on function public.team_tournament_pp_share_team(jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.team_tournament_pp_relation(text, jsonb, jsonb, text, boolean)
  from public, anon, authenticated;
revoke all on function public.team_tournament_pp_sanitize_teams(jsonb)
  from public, anon, authenticated;

revoke all on function public.team_tournament_form_pairing_opaque(text, jsonb, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.team_tournament_form_pairing_opaque(text, jsonb, text, text, text, text, boolean)
  to authenticated;
