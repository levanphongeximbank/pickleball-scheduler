-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-production-referee-foundation-01
-- Read-only. STAGING_MUTATIONS=0. PRODUCTION_MUTATIONS=0.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_fail text[] := '{}';
  v_create text;
  v_elig text;
  v_pol text;
  v_anon_exists boolean;
begin
  -- OBJECT_PRESENCE
  if to_regclass('public.referee_assignments') is null then
    v_fail := array_append(v_fail, 'missing.referee_assignments');
  end if;
  if to_regclass('public.match_live_states') is null then
    v_fail := array_append(v_fail, 'missing.match_live_states');
  end if;
  if to_regclass('public.team_sub_match_referee_links') is null then
    v_fail := array_append(v_fail, 'missing.team_sub_match_referee_links');
  end if;

  -- SIGNATURES
  if to_regprocedure('public.referee_v5_assignment_effective_status(text,timestamptz,timestamptz)') is null then
    v_fail := array_append(v_fail, 'missing.assignment_effective_status');
  end if;
  if to_regprocedure('public.referee_v5_match_state_id(text,text,text)') is null then
    v_fail := array_append(v_fail, 'missing.match_state_id');
  end if;
  if to_regprocedure('public.team_tournament_build_v5_state_shell(text,text,text,text[],text[],text,jsonb)') is null then
    v_fail := array_append(v_fail, 'missing.build_v5_state_shell');
  end if;
  if to_regprocedure('public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)') is null then
    v_fail := array_append(v_fail, 'missing.provision_eligibility');
  end if;
  if to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is null then
    v_fail := array_append(v_fail, 'missing.create_referee_assignment');
  end if;

  -- CONSTRAINTS
  if to_regclass('public.referee_assignments') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.referee_assignments'::regclass
         and contype = 'u'
         and conname = 'referee_assignments_tenant_id_tournament_id_match_id_role_r_key'
     ) then
    v_fail := array_append(v_fail, 'missing.unique.referee_assignments_canonical_key');
  end if;

  -- INDEXES
  if to_regclass('public.referee_assignments_match_idx') is null then
    v_fail := array_append(v_fail, 'missing.index.referee_assignments_match_idx');
  end if;
  if to_regclass('public.match_live_states_tournament_idx') is null then
    v_fail := array_append(v_fail, 'missing.index.match_live_states_tournament_idx');
  end if;
  if to_regclass('public.idx_tt5b_referee_links_tournament') is null then
    v_fail := array_append(v_fail, 'missing.index.idx_tt5b_referee_links_tournament');
  end if;

  -- RLS
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'referee_assignments'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then
    v_fail := array_append(v_fail, 'rls.referee_assignments_not_forced');
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'match_live_states'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then
    v_fail := array_append(v_fail, 'rls.match_live_states_not_forced');
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'team_sub_match_referee_links'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then
    v_fail := array_append(v_fail, 'rls.team_sub_match_referee_links_not_forced');
  end if;

  -- POLICIES
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'referee_assignments'
      and policyname = 'referee_assignments_select'
  ) then
    v_fail := array_append(v_fail, 'policy.missing.referee_assignments_select');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'match_live_states'
      and policyname = 'match_live_states_select'
  ) then
    v_fail := array_append(v_fail, 'policy.missing.match_live_states_select');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'team_sub_match_referee_links'
      and policyname = 'team_sub_match_referee_links_select'
  ) then
    v_fail := array_append(v_fail, 'policy.missing.team_sub_match_referee_links_select');
  end if;

  select coalesce(string_agg(qual, ' '), '') into v_pol
  from pg_policies
  where schemaname = 'public'
    and tablename in ('referee_assignments', 'match_live_states', 'team_sub_match_referee_links')
    and cmd = 'SELECT';
  if position('user_venue_id' in v_pol) = 0 then
    v_fail := array_append(v_fail, 'tenant_guards.missing_user_venue_id');
  end if;
  if position('is_super_admin' in v_pol) = 0 then
    v_fail := array_append(v_fail, 'tenant_guards.missing_is_super_admin');
  end if;
  if position('from public.profiles where id = auth.uid()' in v_pol) > 0 then
    v_fail := array_append(v_fail, 'tenant_guards.raw_profiles_venue_id');
  end if;

  -- GRANTS / ANON_DENIED
  select exists (select 1 from pg_roles where rolname = 'anon') into v_anon_exists;
  if v_anon_exists then
    if has_table_privilege('anon', 'public.referee_assignments', 'insert')
       or has_table_privilege('anon', 'public.referee_assignments', 'update')
       or has_table_privilege('anon', 'public.referee_assignments', 'delete')
       or has_table_privilege('anon', 'public.match_live_states', 'insert')
       or has_table_privilege('anon', 'public.match_live_states', 'update')
       or has_table_privilege('anon', 'public.match_live_states', 'delete')
       or has_table_privilege('anon', 'public.team_sub_match_referee_links', 'insert')
       or has_table_privilege('anon', 'public.team_sub_match_referee_links', 'update')
       or has_table_privilege('anon', 'public.team_sub_match_referee_links', 'delete') then
      v_fail := array_append(v_fail, 'anon_denied.table_write');
    end if;
    if has_function_privilege(
         'anon',
         'public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)',
         'execute'
       )
       or has_function_privilege(
         'anon',
         'public.team_tournament_build_v5_state_shell(text,text,text,text[],text[],text,jsonb)',
         'execute'
       )
       or has_function_privilege(
         'anon',
         'public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)',
         'execute'
       ) then
      v_fail := array_append(v_fail, 'anon_denied.rpc_execute');
    end if;
  end if;

  -- Foundation bodies must remain pre-canonical (final continuation not applied yet)
  v_create := pg_get_functiondef(
    'public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)'::regprocedure
  );
  if position('v_parent' in v_create) > 0 then
    v_fail := array_append(v_fail, 'create_already_canonical_parent_scope');
  end if;
  v_elig := pg_get_functiondef(
    'public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)'::regprocedure
  );
  if position('dreambreaker_out_of_scope' in v_elig) = 0 then
    v_fail := array_append(v_fail, 'eligibility_missing_precanonical_dreambreaker_block');
  end if;

  -- Final continuation objects must not be claimed by foundation VERIFY as owned,
  -- but their absence is expected and OK.
  if to_regprocedure(
    'public.team_tournament_resolve_effective_referee_assignment(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)'
  ) is not null then
    raise notice 'VERIFY_NOTICE final_continuation_resolve_present';
  end if;

  -- CANONICAL_REFEREE_LIFECYCLE_PRESTATE_READY
  -- Mirror team-tournament-canonical-referee-lifecycle-01/01_PRECHECK object list.
  if to_regclass('public.referee_assignments') is null
     or to_regclass('public.team_sub_match_referee_links') is null
     or to_regclass('public.match_live_states') is null
     or to_regclass('public.team_tournament_dreambreaker_states') is null
     or to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is null
     or to_regprocedure('public.team_tournament_start_dreambreaker(text,text,integer,text)') is null
     or to_regprocedure('public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)') is null
     or to_regprocedure('public.team_tournament_provision_eligibility(team_tournaments,team_tournament_matchups,team_tournament_sub_matches,uuid)') is null
     or to_regprocedure('public.team_tournament_can_manage_results()') is null
     or to_regprocedure('public.team_tournament_can_manage()') is null
     or to_regprocedure('public.team_tournament_build_v5_state_shell(text,text,text,text[],text[],text,jsonb)') is null then
    v_fail := array_append(v_fail, 'CANONICAL_REFEREE_LIFECYCLE_PRESTATE_READY=NO');
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'VERIFY_FAIL %', array_to_string(v_fail, ',');
  end if;
  raise notice 'VERIFY_PASS OBJECT_PRESENCE=PASS SIGNATURES=PASS CONSTRAINTS=PASS INDEXES=PASS RLS=PASS POLICIES=PASS GRANTS=PASS ANON_DENIED=PASS TENANT_GUARDS=PASS CANONICAL_REFEREE_LIFECYCLE_PRESTATE_READY=YES';
end;
$$;
