-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: core13-canonical-assignment-runtime-closure-01
-- LOCAL PACKAGE ONLY. Do NOT apply on Staging/Production without Owner GO.
-- Read-only. No business DML. Covers grants, RLS, actor, authz, search_path
-- — not merely object existence.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_fail text[] := '{}';
  v_def text;
  v_assign text := 'public.competition_assign_referee(text,text,text,uuid,text,integer,text,uuid,text,text,jsonb)';
  v_replace text := 'public.competition_replace_referee(text,text,text,uuid,text,integer,text,uuid,text,text,boolean,jsonb)';
  v_unassign text := 'public.competition_unassign_referee(text,text,text,text,integer,text,uuid,text,text,jsonb)';
  v_boundary text := 'public.competition_assignment_assert_mutation_boundary(text,text,text,uuid,text,boolean)';
  v_fn text;
  v_rpc text[] := array[v_assign, v_replace, v_unassign];
  v_helper text;
  v_helpers text[] := array[
    v_boundary,
    'public.competition_assignment_remember_idempotency(text,text,text,text,text,uuid,integer)',
    'public.competition_assignment_write_audit(text,text,text,uuid,uuid,uuid,text,uuid,text,text,text,integer,integer,boolean,jsonb)',
    'public.competition_assignment_check_idempotency(text,text,text,text)',
    'public.competition_assignment_scope_version(text,text,text,text)'
  ];
begin
  if to_regclass('public.referee_assignments') is null then
    v_fail := array_append(v_fail, 'missing.referee_assignments');
  end if;

  if to_regclass('public.competition_referee_assignment_audit') is null then
    v_fail := array_append(v_fail, 'missing.competition_referee_assignment_audit');
  end if;

  if to_regclass('public.competition_referee_assignment_idempotency') is null then
    v_fail := array_append(v_fail, 'missing.competition_referee_assignment_idempotency');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'referee_assignments'
      and column_name = 'version'
  ) then
    v_fail := array_append(v_fail, 'missing.referee_assignments.version');
  end if;

  if to_regprocedure(v_assign) is null then
    v_fail := array_append(v_fail, 'missing.competition_assign_referee');
  end if;

  if to_regprocedure(v_replace) is null then
    v_fail := array_append(v_fail, 'missing.competition_replace_referee');
  end if;

  if to_regprocedure(v_unassign) is null then
    v_fail := array_append(v_fail, 'missing.competition_unassign_referee');
  end if;

  if to_regprocedure(v_boundary) is null then
    v_fail := array_append(v_fail, 'missing.competition_assignment_assert_mutation_boundary');
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competition_referee_assignments_active_match_role_uq'
  ) then
    v_fail := array_append(v_fail, 'missing.active_match_role_uq');
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competition_referee_assignment_audit_scope_idx'
  ) then
    v_fail := array_append(v_fail, 'missing.audit_scope_idx');
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competition_referee_assignment_audit_idempotency_idx'
  ) then
    v_fail := array_append(v_fail, 'missing.audit_idempotency_idx');
  end if;

  -- RLS enabled on new tables.
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'competition_referee_assignment_audit'
      and c.relrowsecurity
  ) then
    v_fail := array_append(v_fail, 'rls.disabled.audit');
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'competition_referee_assignment_idempotency'
      and c.relrowsecurity
  ) then
    v_fail := array_append(v_fail, 'rls.disabled.idempotency');
  end if;

  -- S01: authenticated/anon/public must not SELECT audit globally.
  if has_table_privilege('authenticated', 'public.competition_referee_assignment_audit', 'SELECT') then
    v_fail := array_append(v_fail, 'grant.audit.select.authenticated');
  end if;
  if has_table_privilege('anon', 'public.competition_referee_assignment_audit', 'SELECT') then
    v_fail := array_append(v_fail, 'grant.audit.select.anon');
  end if;
  if has_table_privilege('authenticated', 'public.competition_referee_assignment_audit', 'INSERT')
     or has_table_privilege('authenticated', 'public.competition_referee_assignment_audit', 'UPDATE')
     or has_table_privilege('authenticated', 'public.competition_referee_assignment_audit', 'DELETE') then
    v_fail := array_append(v_fail, 'grant.audit.write.authenticated');
  end if;
  if has_table_privilege('authenticated', 'public.competition_referee_assignment_idempotency', 'SELECT') then
    v_fail := array_append(v_fail, 'grant.idempotency.select.authenticated');
  end if;
  if has_table_privilege('anon', 'public.competition_referee_assignment_idempotency', 'SELECT') then
    v_fail := array_append(v_fail, 'grant.idempotency.select.anon');
  end if;

  foreach v_fn in array v_rpc loop
    -- SECURITY DEFINER + fixed search_path.
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.oid = v_fn::regprocedure
        and p.prosecdef
        and coalesce(array_to_string(p.proconfig, ','), '') ilike '%search_path=public%'
    ) then
      v_fail := array_append(v_fail, format('search_path.%s', v_fn));
    end if;

    if has_function_privilege('anon', v_fn, 'EXECUTE') then
      v_fail := array_append(v_fail, format('anon.execute.%s', v_fn));
    end if;
    if has_function_privilege('public', v_fn, 'EXECUTE') then
      v_fail := array_append(v_fail, format('public.execute.%s', v_fn));
    end if;
    if not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
      v_fail := array_append(v_fail, format('authenticated.execute.missing.%s', v_fn));
    end if;

    v_def := pg_get_functiondef(v_fn::regprocedure);
    if position('competition_assignment_assert_mutation_boundary' in v_def) = 0 then
      v_fail := array_append(v_fail, format('authz.missing.%s', v_fn));
    end if;
    if v_def ilike '%coalesce(p_actor_id, auth.uid())%'
       or v_def ilike '%coalesce(p_actor_id,auth.uid())%' then
      v_fail := array_append(v_fail, format('actor.spoof.%s', v_fn));
    end if;
    if position('EXPECTED_VERSION_REQUIRED' in v_def) = 0
       or position('STALE_WRITE' in v_def) = 0 then
      v_fail := array_append(v_fail, format('cas.missing.%s', v_fn));
    end if;
    if position('competition_assignment_check_idempotency' in v_def) = 0 then
      v_fail := array_append(v_fail, format('idempotency.missing.%s', v_fn));
    end if;
  end loop;

  v_def := pg_get_functiondef(v_boundary::regprocedure);
  if position('canonical_tournament_assert_tenant' in v_def) = 0 then
    v_fail := array_append(v_fail, 'boundary.missing.canonical_tournament_assert_tenant');
  end if;
  if position('canonical_tournament_assert_permission' in v_def) = 0 then
    v_fail := array_append(v_fail, 'boundary.missing.canonical_tournament_assert_permission');
  end if;
  if position('ACTOR_SPOOFING_DENIED' in v_def) = 0 then
    v_fail := array_append(v_fail, 'boundary.missing.ACTOR_SPOOFING_DENIED');
  end if;
  if position('CROSS_TOURNAMENT_DENIED' in v_def) = 0 then
    v_fail := array_append(v_fail, 'boundary.missing.CROSS_TOURNAMENT_DENIED');
  end if;
  if position('LIFECYCLE_DENIED' in v_def) = 0 then
    v_fail := array_append(v_fail, 'boundary.missing.LIFECYCLE_DENIED');
  end if;
  if v_def ilike '%p_lifecycle_state%' then
    v_fail := array_append(v_fail, 'boundary.trusts.p_lifecycle_state');
  end if;

  foreach v_helper in array v_helpers loop
    if to_regprocedure(v_helper) is null then
      v_fail := array_append(v_fail, format('missing.helper.%s', v_helper));
      continue;
    end if;
    if has_function_privilege('anon', v_helper, 'EXECUTE')
       or has_function_privilege('authenticated', v_helper, 'EXECUTE')
       or has_function_privilege('public', v_helper, 'EXECUTE') then
      v_fail := array_append(v_fail, format('helper.client.execute.%s', v_helper));
    end if;
    if not exists (
      select 1
      from pg_proc p
      where p.oid = v_helper::regprocedure
        and p.prosecdef
        and coalesce(array_to_string(p.proconfig, ','), '') ilike '%search_path=public%'
    ) then
      v_fail := array_append(v_fail, format('helper.search_path.%s', v_helper));
    end if;
  end loop;

  -- Replace remains a single-transaction revoke+insert (atomic).
  v_def := pg_get_functiondef(v_replace::regprocedure);
  if position('status = ''revoked''' in v_def) = 0
     and position('status=''revoked''' in v_def) = 0 then
    v_fail := array_append(v_fail, 'replace.missing.revoke');
  end if;

  if array_length(v_fail, 1) is not null then
    raise exception 'VERIFY_FAIL %', array_to_string(v_fail, ',');
  end if;

  raise notice 'VERIFY_PASS core13-canonical-assignment-runtime-closure-01 (security+objects)';
end;
$$;

select
  'competition_assign_referee' as object_name,
  (to_regprocedure(
    'public.competition_assign_referee(text,text,text,uuid,text,integer,text,uuid,text,text,jsonb)'
  ) is not null) as ok
union all
select
  'competition_replace_referee',
  (to_regprocedure(
    'public.competition_replace_referee(text,text,text,uuid,text,integer,text,uuid,text,text,boolean,jsonb)'
  ) is not null)
union all
select
  'competition_unassign_referee',
  (to_regprocedure(
    'public.competition_unassign_referee(text,text,text,text,integer,text,uuid,text,text,jsonb)'
  ) is not null)
union all
select
  'competition_assignment_assert_mutation_boundary',
  (to_regprocedure(
    'public.competition_assignment_assert_mutation_boundary(text,text,text,uuid,text,boolean)'
  ) is not null)
union all
select
  'audit_authenticated_select_denied',
  (not has_table_privilege(
    'authenticated',
    'public.competition_referee_assignment_audit',
    'SELECT'
  ))
union all
select
  'anon_assign_execute_denied',
  (not has_function_privilege(
    'anon',
    'public.competition_assign_referee(text,text,text,uuid,text,integer,text,uuid,text,text,jsonb)',
    'EXECUTE'
  ));
