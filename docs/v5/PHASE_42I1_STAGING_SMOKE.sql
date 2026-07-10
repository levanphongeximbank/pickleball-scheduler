-- Phase 42I.1 — Staging smoke (existing staging users)
-- Run AFTER PHASE_42I1_MEMBERSHIP_REVIEW_HOTFIX.sql

do $$
declare
  v_tenant text := 'venue-staging-a';
  v_club text := 'club-smoke-42i1';
  v_sa uuid := '4c3c0474-563d-43ff-8cda-63365094a785';
  v_president uuid := '7b381912-2190-415c-b099-6b1e87567b7a';
  v_vice uuid := 'c1db2b6a-b26b-4d44-8295-9898c92066cd';
  v_applicant uuid := '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c';
  v_tenant_staff uuid := '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c';
  v_other_tenant uuid := 'e54abeac-6619-477a-9eb4-b64b05c1ddba';
  v_president_member uuid := '11111111-1111-1111-1111-111111111101';
  v_vice_member uuid := '11111111-1111-1111-1111-111111111102';
  v_req uuid;
  v_req2 uuid;
  v_req3 uuid;
  v_req4 uuid;
  v_req5 uuid;
  v_result json;
  v_audit_count int;
  v_member_count int;
begin
  insert into public.clubs (id, tenant_id, name, code, status, version)
  values (v_club, v_tenant, 'CLB Smoke 42I1', 'SMK42I1', 'active', 1)
  on conflict (id) do update set deleted_at = null, status = 'active', tenant_id = excluded.tenant_id;

  insert into public.club_members (id, tenant_id, club_id, user_id, membership_type, status, version)
  values
    (v_president_member, v_tenant, v_club, v_president, 'regular', 'active', 1),
    (v_vice_member, v_tenant, v_club, v_vice, 'regular', 'active', 1)
  on conflict (id) do update set status = 'active', user_id = excluded.user_id;

  delete from public.club_governance_assignments where club_id = v_club;
  insert into public.club_governance_assignments (id, tenant_id, club_id, club_member_id, role_code, status, version)
  values
    ('22222222-2222-2222-2222-222222222201', v_tenant, v_club, v_president_member, 'president', 'active', 1),
    ('22222222-2222-2222-2222-222222222202', v_tenant, v_club, v_president_member, 'club_owner', 'active', 1),
    ('22222222-2222-2222-2222-222222222203', v_tenant, v_club, v_vice_member, 'vice_president', 'active', 1);

  delete from public.club_membership_requests_v42 where club_id = v_club;
  delete from public.club_members where club_id = v_club and user_id in (v_applicant, v_other_tenant, v_sa);
  delete from public.audit_logs where club_id = v_club and action like 'club.membership_request.%';

  insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
  values (gen_random_uuid(), v_tenant, v_club, v_applicant, 'smoke pending', 'pending', 1)
  returning id into v_req;

  perform set_config('request.jwt.claim.sub', v_tenant_staff::text, true);
  v_result := public.club_list_pending_requests(v_club);
  if coalesce(v_result->>'ok', 'false') <> 'true' then
    raise exception 'SMOKE_FAIL tenant staff list: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_sa::text, true);
  v_result := public.club_list_pending_requests(v_club);
  if coalesce(v_result->>'ok', 'false') = 'true' or v_result->>'code' <> 'FORBIDDEN' then
    raise exception 'SMOKE_FAIL SA list: %', v_result;
  end if;
  v_result := public.club_review_membership_request(gen_random_uuid(), v_req, 'approved', 'sa', 1);
  if coalesce(v_result->>'ok', 'false') = 'true' or v_result->>'code' <> 'FORBIDDEN' then
    raise exception 'SMOKE_FAIL SA review: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_president::text, true);
  v_result := public.club_review_membership_request(gen_random_uuid(), v_req, 'approved', 'president smoke', 1);
  if coalesce(v_result->>'ok', 'false') <> 'true' then
    raise exception 'SMOKE_FAIL president approve: %', v_result;
  end if;

  select count(*) into v_audit_count
  from public.audit_logs
  where club_id = v_club and action = 'club.membership_request.review'
    and metadata->>'review_action' = 'approve';
  if v_audit_count < 1 then raise exception 'SMOKE_FAIL approve audit missing'; end if;

  insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
  values (gen_random_uuid(), v_tenant, v_club, v_president, 'smoke reject', 'pending', 1)
  returning id into v_req2;

  perform set_config('request.jwt.claim.sub', v_vice::text, true);
  v_result := public.club_review_membership_request(gen_random_uuid(), v_req2, 'rejected', 'vp smoke', 1);
  if coalesce(v_result->>'ok', 'false') <> 'true' then
    raise exception 'SMOKE_FAIL vice president reject: %', v_result;
  end if;

  select count(*) into v_audit_count
  from public.audit_logs
  where club_id = v_club and action = 'club.membership_request.review'
    and metadata->>'review_action' = 'reject';
  if v_audit_count < 1 then raise exception 'SMOKE_FAIL reject audit missing'; end if;

  insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
  values (gen_random_uuid(), v_tenant, v_club, v_president, 'owner path', 'pending', 1)
  returning id into v_req3;

  perform set_config('request.jwt.claim.sub', v_president::text, true);
  v_result := public.club_review_membership_request(gen_random_uuid(), v_req3, 'approved', 'owner smoke', 1);
  if coalesce(v_result->>'ok', 'false') <> 'true' then
    raise exception 'SMOKE_FAIL owner approve: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_other_tenant::text, true);
  v_result := public.club_list_pending_requests(v_club);
  if coalesce(v_result->>'ok', 'false') = 'true' then
    raise exception 'SMOKE_FAIL other tenant should be FORBIDDEN: %', v_result;
  end if;

  insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
  values (gen_random_uuid(), v_tenant, v_club, v_vice, 'regular deny', 'pending', 1)
  returning id into v_req4;

  delete from public.club_governance_assignments
  where club_id = v_club and club_member_id = v_president_member;

  perform set_config('request.jwt.claim.sub', v_president::text, true);
  v_result := public.club_review_membership_request(gen_random_uuid(), v_req4, 'approved', 'nope', 1);
  if coalesce(v_result->>'ok', 'false') = 'true' or v_result->>'code' <> 'FORBIDDEN' then
    raise exception 'SMOKE_FAIL regular member review: %', v_result;
  end if;

  insert into public.club_governance_assignments (id, tenant_id, club_id, club_member_id, role_code, status, version)
  values
    ('22222222-2222-2222-2222-222222222201', v_tenant, v_club, v_president_member, 'president', 'active', 1),
    ('22222222-2222-2222-2222-222222222202', v_tenant, v_club, v_president_member, 'club_owner', 'active', 1)
  on conflict (id) do update set status = 'active';

  update public.club_membership_requests_v42 set status = 'rejected', version = version + 1 where id = v_req4;

  begin
    perform public.phase42_write_audit('INVALID_AUDIT_ACTION_FOR_SMOKE', 'x', 'x', v_tenant, v_club, '{}'::jsonb);
    raise exception 'SMOKE_FAIL audit should have raised';
  exception when others then
    null;
  end;

  create or replace function public.smoke_42i1_audit_fail_guard()
  returns trigger
  language plpgsql
  as $fn$
  begin
    if new.resource_id = '44444444-4444-4444-4444-444444444444' then
      raise exception 'SMOKE_FORCED_AUDIT_FAIL';
    end if;
    return new;
  end;
  $fn$;

  drop trigger if exists smoke_42i1_audit_fail_guard on public.audit_logs;
  create trigger smoke_42i1_audit_fail_guard
    before insert on public.audit_logs
    for each row execute function public.smoke_42i1_audit_fail_guard();

  insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
  values ('44444444-4444-4444-4444-444444444444', v_tenant, v_club, v_president, 'audit rollback', 'pending', 1);

  perform set_config('request.jwt.claim.sub', v_president::text, true);
  v_result := public.club_review_membership_request(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'approved', 'audit fail', 1);
  if coalesce(v_result->>'ok', 'false') = 'true' or v_result->>'code' <> 'AUDIT_WRITE_FAILED' then
    raise exception 'SMOKE_FAIL audit rollback code: %', v_result;
  end if;

  select count(*) into v_audit_count
  from public.club_membership_requests_v42
  where id = '44444444-4444-4444-4444-444444444444' and status = 'pending';
  if v_audit_count <> 1 then
    raise exception 'SMOKE_FAIL audit rollback left request non-pending';
  end if;

  drop trigger if exists smoke_42i1_audit_fail_guard on public.audit_logs;
  drop function if exists public.smoke_42i1_audit_fail_guard();

  insert into public.club_members (id, tenant_id, club_id, user_id, membership_type, status, version)
  values ('11111111-1111-1111-1111-111111111103', v_tenant, v_club, v_sa, 'regular', 'active', 1)
  on conflict (id) do update set status = 'active', user_id = excluded.user_id;

  insert into public.club_governance_assignments (id, tenant_id, club_id, club_member_id, role_code, status, version)
  values ('22222222-2222-2222-2222-222222222204', v_tenant, v_club, '11111111-1111-1111-1111-111111111103', 'vice_president', 'active', 1)
  on conflict (id) do update set status = 'active';

  insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
  values (gen_random_uuid(), v_tenant, v_club, v_other_tenant, 'sa gov approve', 'pending', 1)
  returning id into v_req5;

  perform set_config('request.jwt.claim.sub', v_sa::text, true);
  v_result := public.club_review_membership_request(gen_random_uuid(), v_req5, 'approved', 'sa governance', 1);
  if coalesce(v_result->>'ok', 'false') <> 'true' then
    raise exception 'SMOKE_FAIL SA with governance approve: %', v_result;
  end if;

  insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
  values (gen_random_uuid(), v_tenant, v_club, v_vice, 'idempotent', 'pending', 1)
  returning id into v_req5;

  perform set_config('request.jwt.claim.sub', v_president::text, true);
  v_result := public.club_review_membership_request('33333333-3333-3333-3333-333333333331', v_req5, 'approved', 'once', 1);
  if coalesce(v_result->>'ok', 'false') <> 'true' then raise exception 'SMOKE_FAIL idempotent first: %', v_result; end if;
  v_result := public.club_review_membership_request('33333333-3333-3333-3333-333333333331', v_req5, 'approved', 'once', 1);
  if coalesce(v_result->>'ok', 'false') <> 'true' then raise exception 'SMOKE_FAIL idempotent cache: %', v_result; end if;

  select count(*) into v_member_count
  from public.club_members
  where club_id = v_club and user_id in (v_applicant, v_vice) and status = 'active';
  if v_member_count <> 2 then
    raise exception 'SMOKE_FAIL member count expected 2 got %', v_member_count;
  end if;

  raise notice 'PHASE_42I1_STAGING_SMOKE: PASS';
end;
$$;
