-- Phase 42H — Orphan profile links + leave cleanup
-- 1) Clear orphan profiles.club_id / player_id (legacy)
-- 2) club_get_my_active_membership — membership SoT for client
-- 3) club_leave_membership clears legacy profile links in same txn + audit

-- ---------------------------------------------------------------------------
-- Controlled clear: orphan club_id (club missing) + orphan player_id (no athletes row)
-- ---------------------------------------------------------------------------
update public.profiles p
set club_id = null,
    updated_at = now()
where p.club_id is not null
  and not exists (
    select 1 from public.clubs c
    where c.id = p.club_id and c.deleted_at is null
  );

update public.profiles p
set player_id = null,
    updated_at = now()
where p.player_id is not null
  and to_regclass('public.athletes') is not null
  and not exists (
    select 1 from public.athletes a
    where a.id::text = p.player_id::text or a.user_id = p.id
  )
  -- keep player_id if it matches a club blob player id pattern only when athletes empty:
  -- Phase 42: player_id is legacy; clear when no athletes link for this user
  and not exists (
    select 1 from public.athletes a2 where a2.user_id = p.id and a2.status = 'active'
  );

-- ---------------------------------------------------------------------------
-- Helper: clear legacy profile club links (never elevates role)
-- ---------------------------------------------------------------------------
create or replace function public.phase42_clear_profile_club_links(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  update public.profiles
  set club_id = null,
      player_id = null,
      updated_at = now()
  where id = p_user_id
    and (club_id is not null or player_id is not null);
end;
$$;

-- ---------------------------------------------------------------------------
-- club_get_my_active_membership — Cloud SSOT for hasClub
-- ---------------------------------------------------------------------------
create or replace function public.club_get_my_active_membership()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id text;
  v_member_id uuid;
  v_data jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  select cm.id, cm.club_id
    into v_member_id, v_club_id
  from public.club_members cm
  join public.clubs c on c.id = cm.club_id and c.deleted_at is null
  where cm.user_id = auth.uid()
    and cm.status = 'active'
  order by cm.joined_at nulls last, cm.created_at desc
  limit 1;

  if v_club_id is null then
    return json_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'club_id', null,
        'member_id', null,
        'has_active_membership', false
      )
    );
  end if;

  v_data := public.phase42_club_canonical(v_club_id);
  return json_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'club_id', v_club_id,
      'member_id', v_member_id,
      'has_active_membership', true,
      'club', v_data
    )
  );
end;
$$;

grant execute on function public.club_get_my_active_membership() to authenticated;

-- ---------------------------------------------------------------------------
-- club_leave_membership — clear legacy profile links in same transaction
-- ---------------------------------------------------------------------------
create or replace function public.club_leave_membership(p_request_id uuid, p_club_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_member public.club_members%rowtype;
  v_resp jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;
  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_leave_membership');
  if v_cached is not null then
    return v_cached::json;
  end if;

  select * into v_club from public.clubs where id = trim(coalesce(p_club_id, '')) and deleted_at is null;
  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  select * into v_member
  from public.club_members
  where club_id = v_club.id and user_id = auth.uid() and status = 'active';
  if not found then
    -- Still clear orphan profile links if any
    perform public.phase42_clear_profile_club_links(auth.uid());
    return public.phase42_err('NOT_MEMBER', 'Bạn không phải thành viên active.');
  end if;

  if exists (
    select 1 from public.club_governance_assignments g
    where g.club_member_id = v_member.id
      and g.status = 'active'
      and g.role_code in ('president', 'club_owner')
  ) then
    return public.phase42_err('GOVERNANCE_BLOCK', 'Chủ tịch/Chủ sở hữu phải chuyển quyền trước khi rời.');
  end if;

  update public.club_governance_assignments
  set status = 'ended', effective_to = now(), version = version + 1
  where club_member_id = v_member.id and status = 'active';

  update public.club_members
  set status = 'left', left_at = now(), version = version + 1
  where id = v_member.id;

  perform public.phase42_clear_profile_club_links(auth.uid());

  perform public.phase42_write_audit(
    'club.leave_membership',
    'club_member',
    v_member.id::text,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'cleared_profile_club_links', true
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('club_id', v_club.id, 'status', 'left'),
    'version', v_member.version + 1
  );
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_leave_membership', v_club.id, v_resp);
  return v_resp::json;
end;
$$;

grant execute on function public.club_leave_membership(uuid, text) to authenticated;
