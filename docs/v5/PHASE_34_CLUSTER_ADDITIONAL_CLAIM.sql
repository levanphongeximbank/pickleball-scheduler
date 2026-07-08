-- Phase 34 — Allow additional cluster claim requests for owners who already have clusters
-- Chạy SAU: PHASE_33_COURT_CLAIM_REQUESTS.sql
-- Staging: qyewbxjsiiyufanzcjcq | Production: expuvcohlcjzvrrauvud

create or replace function public.court_submit_claim_request(
  p_cluster_ids text[],
  p_message text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.profiles%rowtype;
  v_cluster_id text;
  v_venue_id text;
  v_first_venue text;
  v_id text;
  v_row public.court_claim_requests%rowtype;
  v_ids text[];
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  select * into v_user from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  if v_user.role = 'SUPER_ADMIN' then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Platform admin không yêu cầu gắn cụm');
  end if;

  if exists (
    select 1 from public.court_claim_requests r
    where r.user_id = auth.uid() and r.status = 'pending'
  ) then
    return json_build_object('ok', false, 'code', 'DUPLICATE_PENDING');
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
    if exists (
      select 1 from public.user_cluster_assignments uca
      where uca.user_id = auth.uid() and uca.cluster_id = v_cluster_id
    ) then
      return json_build_object(
        'ok', false,
        'code', 'ALREADY_OWNED',
        'error', 'Bạn đã sở hữu cụm: ' || v_cluster_id
      );
    end if;

    if not public.is_cluster_unassigned(v_cluster_id) then
      return json_build_object(
        'ok', false,
        'code', 'CLUSTER_NOT_AVAILABLE',
        'error', 'Cụm sân không còn trống: ' || v_cluster_id
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
        'error', 'Chỉ chọn cụm sân cùng một tổ chức trong một yêu cầu'
      );
    end if;
  end loop;

  v_id := 'ccr-' || auth.uid()::text || '-' || extract(epoch from now())::bigint::text;

  insert into public.court_claim_requests (
    id, user_id, venue_id, cluster_ids, message, status
  ) values (
    v_id,
    auth.uid(),
    v_first_venue,
    v_ids,
    coalesce(p_message, ''),
    'pending'
  )
  returning * into v_row;

  return json_build_object('ok', true, 'request', row_to_json(v_row));
exception
  when others then
    return json_build_object('ok', false, 'code', 'SUBMIT_FAILED', 'error', sqlerrm);
end;
$$;

grant execute on function public.court_submit_claim_request(text[], text) to authenticated;
