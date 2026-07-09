-- Phase 35 — Admin assign cluster owner (Supabase, not localStorage)
-- Chạy SAU: PHASE_33_COURT_CLAIM_REQUESTS.sql, PHASE_34_CLUSTER_ADDITIONAL_CLAIM.sql
-- Production: expuvcohlcjzvrrauvud

create or replace function public.court_admin_assign_cluster_owner(
  p_user_id uuid,
  p_cluster_ids text[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_cluster_id text;
  v_venue_id text;
  v_first_venue text;
  v_ids text[];
  v_sub public.tenant_subscriptions%rowtype;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.can_review_court_claim() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_user_id is null then
    return json_build_object('ok', false, 'code', 'USER_ID_REQUIRED');
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return json_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  v_ids := array(
    select distinct trim(x)
    from unnest(coalesce(p_cluster_ids, '{}'::text[])) as x
    where trim(x) <> ''
  );

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return json_build_object('ok', false, 'code', 'CLUSTER_IDS_REQUIRED');
  end if;

  foreach v_cluster_id in array v_ids loop
    if not exists (
      select 1 from public.court_clusters c
      where c.id = v_cluster_id and c.status = 'active'
    ) then
      return json_build_object(
        'ok', false,
        'code', 'CLUSTER_NOT_FOUND',
        'error', 'Không tìm thấy cụm: ' || v_cluster_id
      );
    end if;

    select c.venue_id into v_venue_id
    from public.court_clusters c
    where c.id = v_cluster_id;

    if v_first_venue is null then
      v_first_venue := v_venue_id;
    elsif v_first_venue is distinct from v_venue_id then
      return json_build_object(
        'ok', false,
        'code', 'MIXED_VENUE_NOT_ALLOWED',
        'error', 'Chỉ gán cụm sân cùng một tổ chức trong một lần'
      );
    end if;
  end loop;

  foreach v_cluster_id in array v_ids loop
    insert into public.user_cluster_assignments (user_id, cluster_id, role)
    values (p_user_id, v_cluster_id, 'CLUSTER_OWNER')
    on conflict (user_id, cluster_id) do update set role = 'CLUSTER_OWNER';

    update public.court_clusters
    set owner_user_id = p_user_id, updated_at = now()
    where id = v_cluster_id;
  end loop;

  if v_profile.venue_id is null then
    update public.profiles
    set
      role = 'COURT_OWNER',
      venue_id = v_first_venue,
      status = 'active',
      updated_at = now()
    where id = p_user_id;

    update public.venues
    set owner_id = p_user_id, updated_at = now()
    where id = v_first_venue
      and owner_id is null;

    begin
      v_sub := public.billing_create_trial_subscription(v_first_venue);
    exception
      when others then
        null;
    end;
  elsif v_profile.venue_id = v_first_venue and v_profile.role = 'PLAYER' then
    update public.profiles
    set role = 'COURT_OWNER', status = 'active', updated_at = now()
    where id = p_user_id;
  end if;

  return json_build_object(
    'ok', true,
    'userId', p_user_id,
    'clusterIds', v_ids,
    'venueId', v_first_venue
  );
exception
  when others then
    return json_build_object('ok', false, 'code', 'ASSIGN_FAILED', 'error', sqlerrm);
end;
$$;

grant execute on function public.court_admin_assign_cluster_owner(uuid, text[]) to authenticated;
