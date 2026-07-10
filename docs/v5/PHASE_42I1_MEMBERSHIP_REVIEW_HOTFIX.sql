-- Phase 42I.1 — Hotfix: SA/PLATFORM_ADMIN auth + mandatory audit + rollback on audit fail
-- Apply STAGING first. Production cleanup in PHASE_42I1_PRODUCTION_QA_CLEANUP.sql (separate GO).
-- Rollback: docs/v5/PHASE_42I1_ROLLBACK.sql

-- ---------------------------------------------------------------------------
-- 1) audit_logs — allow Phase 42 club actions (root cause of silent audit fail)
-- ---------------------------------------------------------------------------
alter table public.audit_logs drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in (
    'login', 'login_failed', 'logout',
    'create', 'update', 'delete',
    'assign_role', 'permission_change',
    'password_change', 'reset_password',
    'club.create',
    'club.leave_membership',
    'club.membership_request.review',
    'club.membership_request.correction'
  ));

insert into public.role_permissions (role_id, permission_id)
select r.role_id, 'club.membership.review'
from (values ('TENANT_OWNER'), ('CLUB_MANAGER'), ('VENUE_OWNER')) as r(role_id)
where exists (select 1 from public.permissions p where p.id = 'club.membership.review')
  and exists (select 1 from public.roles ro where ro.id = r.role_id)
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.role_id and rp.permission_id = 'club.membership.review'
  );

-- ---------------------------------------------------------------------------
-- 2) Platform admin detector (SUPER_ADMIN + PLATFORM_ADMIN)
-- ---------------------------------------------------------------------------
create or replace function public.phase42_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role, '')) in ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  );
$$;

-- Tenant staff membership without platform-admin bypass
create or replace function public.phase42_is_tenant_staff_member(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.venue_id = p_tenant_id
      and upper(coalesce(p.role, '')) in (
        'VENUE_OWNER', 'COURT_OWNER', 'VENUE_MANAGER', 'COURT_MANAGER', 'TENANT_OWNER', 'CLUB_MANAGER'
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Review authorization — platform admin cannot use global permission path
-- ---------------------------------------------------------------------------
create or replace function public.phase42_can_review_membership(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.club_governance_assignments g
      join public.club_members cm on cm.id = g.club_member_id
      where g.club_id = p_club_id
        and g.status = 'active'
        and g.role_code = any (array['club_owner','president','vice_president'])
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
    or (
      not public.phase42_is_platform_admin()
      and public.user_has_permission('club.membership.review')
      and exists (
        select 1
        from public.clubs c
        where c.id = p_club_id
          and c.deleted_at is null
          and public.phase42_is_tenant_staff_member(c.tenant_id)
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 4) Audit writer — fail loud (no swallowed exceptions)
-- ---------------------------------------------------------------------------
create or replace function public.phase42_write_audit(
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_tenant_id text,
  p_club_id text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs (
    actor_id, actor_email, action, resource_type, resource_id, venue_id, club_id, metadata
  ) values (
    auth.uid(),
    coalesce(v_email, ''),
    p_action,
    p_resource_type,
    p_resource_id,
    p_tenant_id,
    p_club_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Review RPC — mandatory audit with before/after; rollback on audit fail
-- ---------------------------------------------------------------------------
create or replace function public.club_review_membership_request(
  p_request_id uuid,
  p_membership_request_id uuid,
  p_decision text,
  p_review_note text default null,
  p_expected_version integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached jsonb;
  v_row public.club_membership_requests_v42%rowtype;
  v_member_id uuid;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_review_action text;
  v_before jsonb;
  v_after jsonb;
  v_resp jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;
  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_review_membership_request');
  if v_cached is not null then
    return v_cached::json;
  end if;

  select * into v_row
  from public.club_membership_requests_v42
  where id = p_membership_request_id
  for update;

  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy yêu cầu.');
  end if;

  if not public.phase42_can_review_membership(v_row.club_id) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền duyệt.');
  end if;

  if v_row.status <> 'pending' then
    return public.phase42_err('INVALID_STATUS', 'Yêu cầu không còn pending.');
  end if;

  if p_expected_version is not null and v_row.version <> p_expected_version then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản.');
  end if;

  if v_decision not in ('approved', 'rejected') then
    return public.phase42_err('INVALID_DECISION', 'decision phải approved|rejected.');
  end if;

  v_review_action := case when v_decision = 'approved' then 'approve' else 'reject' end;
  v_before := to_jsonb(v_row);

  begin
    update public.club_membership_requests_v42
    set
      status = v_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note,
      version = version + 1
    where id = v_row.id
    returning * into v_row;

    if v_decision = 'approved' then
      select id into v_member_id
      from public.club_members
      where club_id = v_row.club_id
        and user_id = v_row.user_id
        and status = 'active';

      if v_member_id is null then
        insert into public.club_members (tenant_id, club_id, user_id, membership_type, status, version)
        values (v_row.tenant_id, v_row.club_id, v_row.user_id, 'regular', 'active', 1)
        returning id into v_member_id;
      end if;
    end if;

    v_after := jsonb_build_object(
      'request', to_jsonb(v_row),
      'member_id', v_member_id,
      'status', v_decision
    );

    begin
      perform public.phase42_write_audit(
        'club.membership_request.review',
        'club_membership_request',
        v_row.id::text,
        v_row.tenant_id,
        v_row.club_id,
        jsonb_build_object(
          'tenant_id', v_row.tenant_id,
          'club_id', v_row.club_id,
          'request_id', v_row.id,
          'reviewer_user_id', auth.uid(),
          'review_action', v_review_action,
          'before_data', v_before,
          'after_data', v_after,
          'created_at', now()
        )
      );
    exception
      when others then
        raise exception 'AUDIT_WRITE_FAILED: %', sqlerrm;
    end;

    v_resp := jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'id', v_row.id,
        'club_id', v_row.club_id,
        'user_id', v_row.user_id,
        'status', v_decision,
        'member_id', v_member_id
      ),
      'version', v_row.version
    );

    perform public.phase42_idempotency_put(
      p_request_id,
      v_row.tenant_id,
      'club_review_membership_request',
      v_row.id::text,
      v_resp
    );

    return v_resp::json;
  exception
    when others then
      return public.phase42_err(
        case
          when sqlerrm ilike 'AUDIT_WRITE_FAILED:%' then 'AUDIT_WRITE_FAILED'
          else 'REVIEW_FAILED'
        end,
        sqlerrm
      );
  end;
end;
$$;

-- list pending unchanged gate (uses phase42_can_review_membership)
create or replace function public.club_list_pending_requests(p_club_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club public.clubs%rowtype;
  v_rows jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  select * into v_club
  from public.clubs
  where id = trim(coalesce(p_club_id, ''))
    and deleted_at is null;

  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  if not public.phase42_can_review_membership(v_club.id) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền duyệt yêu cầu.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'club_id', r.club_id,
    'user_id', r.user_id,
    'message', r.message,
    'status', r.status,
    'display_name', coalesce(p.display_name, p.email, r.user_id::text),
    'created_at', r.created_at,
    'version', r.version
  ) order by r.created_at), '[]'::jsonb)
  into v_rows
  from public.club_membership_requests_v42 r
  left join public.profiles p on p.id = r.user_id
  where r.club_id = v_club.id
    and r.status = 'pending';

  return json_build_object('ok', true, 'data', v_rows);
end;
$$;

grant execute on function public.phase42_is_platform_admin() to authenticated;
grant execute on function public.phase42_is_tenant_staff_member(text) to authenticated;
grant execute on function public.club_list_pending_requests(text) to authenticated;
grant execute on function public.club_review_membership_request(uuid, uuid, text, text, integer) to authenticated;
