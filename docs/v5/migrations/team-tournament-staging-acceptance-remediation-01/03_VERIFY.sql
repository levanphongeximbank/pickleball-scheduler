-- team-tournament-staging-acceptance-remediation-01 / 03_VERIFY
-- LOCAL PACKAGE ONLY. Do not apply without Owner GO.

do $$
declare
  v_rename text;
  v_opaque text;
  v_internal text;
  v_grant_internal int;
  v_grant_opaque_anon int;
  v_grant_rename_anon int;
  v_view_rpc text;
begin
  if to_regprocedure('public.team_tournament_rename(text,text)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_rename missing';
  end if;
  if to_regprocedure('public.team_tournament_form_pairing_opaque(text,jsonb,text,text,text,text,boolean)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_form_pairing_opaque missing';
  end if;
  if to_regprocedure('public.private_pairing_load_active_rules_internal(text,text,text)') is null then
    raise exception 'VERIFY_FAIL: private_pairing_load_active_rules_internal missing';
  end if;

  v_rename := pg_get_functiondef('public.team_tournament_rename(text,text)'::regprocedure);
  if position('canonical_tournaments' in lower(v_rename)) = 0 then
    raise exception 'VERIFY_FAIL: rename must write canonical_tournaments.name';
  end if;
  if position('team_tournaments' in lower(v_rename)) = 0 then
    raise exception 'VERIFY_FAIL: rename must write team_tournaments.name';
  end if;
  if position('tournament_id' in lower(v_rename)) = 0 then
    raise exception 'VERIFY_FAIL: rename must key identity by tournament_id';
  end if;
  if position('where id = v_canonical.id' in lower(v_rename)) > 0
     or position('canonical.id = v_header.id' in lower(v_rename)) > 0
     or position('t.id = v_header.id' in lower(v_rename)) > 0 then
    raise exception 'VERIFY_FAIL: must not require canonical.id = header.id';
  end if;

  v_opaque := pg_get_functiondef(
    'public.team_tournament_form_pairing_opaque(text,jsonb,text,text,text,text,boolean)'::regprocedure
  );
  if position('private_pairing_load_active_rules_internal' in lower(v_opaque)) = 0 then
    raise exception 'VERIFY_FAIL: opaque runtime must load rules internally';
  end if;
  if position('private_pairing_get_active_rules_for_scope' in lower(v_opaque)) > 0 then
    raise exception 'VERIFY_FAIL: opaque runtime must not call Super Admin view RPC';
  end if;
  if position('pairing.private_rules.view' in lower(v_opaque)) > 0 then
    raise exception 'VERIFY_FAIL: opaque runtime must not require view permission';
  end if;
  if position('reason_text' in lower(v_opaque)) > 0 then
    raise exception 'VERIFY_FAIL: opaque response must not include reason_text';
  end if;
  if position('NO_FEASIBLE_PAIRING' in v_opaque) = 0 then
    raise exception 'VERIFY_FAIL: opaque runtime must emit NO_FEASIBLE_PAIRING';
  end if;
  if position('team_tournament_can_manage' in lower(v_opaque)) = 0 then
    raise exception 'VERIFY_FAIL: opaque runtime must use organizer authority';
  end if;

  v_internal := pg_get_functiondef(
    'public.private_pairing_load_active_rules_internal(text,text,text)'::regprocedure
  );
  if position('pairing.private_rules.view' in lower(v_internal)) > 0 then
    raise exception 'VERIFY_FAIL: internal loader must not check view permission';
  end if;
  if position('PERMISSION_DENIED' in v_internal) > 0 then
    raise exception 'VERIFY_FAIL: internal loader must not convert missing view into deny/empty bypass';
  end if;

  v_view_rpc := pg_get_functiondef(
    'public.private_pairing_get_active_rules_for_scope(text,text,text)'::regprocedure
  );
  if position('pairing.private_rules.view' in lower(v_view_rpc)) = 0 then
    raise exception 'VERIFY_FAIL: Super Admin view RPC must remain permission-gated';
  end if;

  select count(*)::int into v_grant_internal
  from information_schema.role_routine_grants
  where specific_schema = 'public'
    and routine_name = 'private_pairing_load_active_rules_internal'
    and grantee in ('anon', 'authenticated', 'PUBLIC');
  if v_grant_internal > 0 then
    raise exception 'VERIFY_FAIL: internal rule loader must not be granted to anon/authenticated';
  end if;

  select count(*)::int into v_grant_opaque_anon
  from information_schema.role_routine_grants
  where specific_schema = 'public'
    and routine_name = 'team_tournament_form_pairing_opaque'
    and grantee in ('anon', 'PUBLIC');
  if v_grant_opaque_anon > 0 then
    raise exception 'VERIFY_FAIL: anon must not execute form_pairing_opaque';
  end if;

  select count(*)::int into v_grant_rename_anon
  from information_schema.role_routine_grants
  where specific_schema = 'public'
    and routine_name = 'team_tournament_rename'
    and grantee in ('anon', 'PUBLIC');
  if v_grant_rename_anon > 0 then
    raise exception 'VERIFY_FAIL: anon must not execute team_tournament_rename';
  end if;

  if to_regprocedure('public.team_tournament_commit_pairing(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'VERIFY_FAIL: team_tournament_commit_pairing must remain';
  end if;
  if to_regprocedure('public.team_tournament_create_referee_assignment(text,text,text,uuid,timestamptz,boolean,text,text)') is null then
    raise exception 'VERIFY_FAIL: PR423 referee assignment RPC must remain';
  end if;

  raise notice 'VERIFY_PASS: team-tournament-staging-acceptance-remediation-01';
end $$;
