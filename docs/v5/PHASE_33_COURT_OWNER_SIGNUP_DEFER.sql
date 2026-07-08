-- Phase 33 — Defer court owner venue creation until cluster claim approved
-- Chạy SAU: PHASE_33_COURT_CLAIM_REQUESTS.sql
-- Thay thế auto-provision từ client signup; giữ auth_register_court_owner cho bootstrap admin.

create or replace function public.auth_register_court_owner_intent(
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_profile.role = 'SUPER_ADMIN' then
    raise exception 'access_denied: platform admin cannot register as court owner';
  end if;

  if v_profile.venue_id is not null then
    raise exception 'already_has_venue';
  end if;

  if exists (
    select 1 from public.user_cluster_assignments uca
    where uca.user_id = v_uid and uca.role = 'CLUSTER_OWNER'
  ) then
    raise exception 'already_assigned';
  end if;

  -- Giữ role PLAYER; chủ sân claim cụm sau khi admin duyệt.
  update public.profiles
  set
    status = 'active',
    updated_at = now()
  where id = v_uid
    and role = 'PLAYER';

  return jsonb_build_object(
    'ok', true,
    'intent', 'court_owner',
    'note', coalesce(nullif(trim(p_note), ''), ''),
    'next_step', 'claim_cluster'
  );
end;
$$;

revoke all on function public.auth_register_court_owner_intent(text) from public;
grant execute on function public.auth_register_court_owner_intent(text) to authenticated;

comment on function public.auth_register_court_owner_intent(text) is
  'Phase 33 — Court owner signup intent only. Venue/cluster assigned after admin approves court_claim_requests.';
