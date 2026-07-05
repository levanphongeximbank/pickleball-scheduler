-- Phase 19B — Court owner self-registration RPC (apply trước khi bật VITE_AUTH_SIGNUP_ENABLED)
-- Chạy trên Production sau migrations #1–#22 + billing_create_trial_subscription (#17).
-- Không expose service_role — chỉ authenticated user gọi RPC cho chính mình.

create or replace function public.auth_register_court_owner(
  p_venue_name text,
  p_venue_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_venue_id text;
  v_slug text;
  v_sub public.tenant_subscriptions%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if nullif(trim(p_venue_name), '') is null then
    raise exception 'venue_name_required';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_profile.role = 'SUPER_ADMIN' then
    raise exception 'access_denied: platform admin cannot self-register as court owner';
  end if;

  if v_profile.venue_id is not null then
    raise exception 'already_has_venue';
  end if;

  if v_profile.role <> 'PLAYER' then
    raise exception 'access_denied: only PLAYER may self-register as court owner';
  end if;

  v_slug := lower(regexp_replace(trim(p_venue_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from coalesce(v_slug, 'venue'));
  if v_slug = '' then
    v_slug := 'venue';
  end if;

  v_venue_id := coalesce(
    nullif(trim(p_venue_id), ''),
    v_slug || '-' || substr(replace(v_uid::text, '-', ''), 1, 8)
  );

  insert into public.venues (
    id,
    name,
    slug,
    owner_id,
    timezone,
    status,
    note
  ) values (
    v_venue_id,
    trim(p_venue_name),
    v_slug || '-' || substr(replace(v_uid::text, '-', ''), 1, 6),
    v_uid,
    'Asia/Ho_Chi_Minh',
    'trial',
    'Court owner self-registration (Phase 19B)'
  )
  on conflict (id) do nothing;

  update public.profiles
  set
    role = 'COURT_OWNER',
    venue_id = v_venue_id,
    status = 'active',
    updated_at = now()
  where id = v_uid;

  update public.venues
  set owner_id = v_uid, updated_at = now()
  where id = v_venue_id;

  v_sub := public.billing_create_trial_subscription(v_venue_id);

  return jsonb_build_object(
    'venue_id', v_venue_id,
    'subscription_id', v_sub.id,
    'subscription_status', v_sub.status
  );
end;
$$;

revoke all on function public.auth_register_court_owner(text, text) from public;
grant execute on function public.auth_register_court_owner(text, text) to authenticated;

comment on function public.auth_register_court_owner(text, text) is
  'Phase 19B — PLAYER self-register as COURT_OWNER: create venue + trial subscription. Idempotent per user (already_has_venue blocks).';
