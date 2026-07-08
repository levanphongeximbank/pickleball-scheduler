-- Phase 33 — Court owner claim requests (claim unassigned clusters + admin approve)
-- Chạy SAU: PHASE_23_COURT_CLUSTERS.sql, supabase-identity-v40-phaseC.sql
-- Spec: docs/v5/COURT_CLUSTER_SPEC.md

create table if not exists public.court_claim_requests (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id text not null,
  cluster_ids text[] not null default '{}',
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists court_claim_requests_user_pending_idx
  on public.court_claim_requests (user_id)
  where status = 'pending';

create index if not exists court_claim_requests_status_idx
  on public.court_claim_requests (status, requested_at desc);

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.is_cluster_unassigned(p_cluster_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.court_clusters c
    where c.id = p_cluster_id
      and c.status = 'active'
      and c.owner_user_id is null
      and not exists (
        select 1
        from public.user_cluster_assignments uca
        where uca.cluster_id = c.id
          and uca.role = 'CLUSTER_OWNER'
      )
  );
$$;

create or replace function public.can_review_court_claim()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.user_has_permission('cluster.manage');
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.court_claim_requests enable row level security;

drop policy if exists "court_claim_requests_select" on public.court_claim_requests;
drop policy if exists "court_claim_requests_insert" on public.court_claim_requests;
drop policy if exists "court_claim_requests_update" on public.court_claim_requests;

create policy "court_claim_requests_select"
  on public.court_claim_requests
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.can_review_court_claim()
  );

create policy "court_claim_requests_insert"
  on public.court_claim_requests
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

create policy "court_claim_requests_update"
  on public.court_claim_requests
  for update
  to authenticated
  using (
    (user_id = auth.uid() and status = 'pending')
    or public.can_review_court_claim()
  )
  with check (true);

-- ─── RPC: list unassigned clusters ──────────────────────────────────────────

create or replace function public.court_list_unassigned_clusters(
  p_search text default '',
  p_limit int default 100
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_rows json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      c.id,
      c.venue_id,
      c.name,
      c.slug,
      c.status,
      coalesce(c.court_count, 0) as court_count,
      coalesce(c.address, '') as address,
      coalesce(c.google_maps_url, '') as google_maps_url,
      coalesce(v.name, c.venue_id) as venue_name
    from public.court_clusters c
    left join public.venues v on v.id = c.venue_id
    where c.status = 'active'
      and public.is_cluster_unassigned(c.id)
      and (
        coalesce(p_search, '') = ''
        or c.name ilike '%' || p_search || '%'
        or coalesce(c.address, '') ilike '%' || p_search || '%'
        or coalesce(v.name, '') ilike '%' || p_search || '%'
      )
    order by c.name asc
    limit v_limit
  ) t;

  return json_build_object('ok', true, 'clusters', coalesce(v_rows, '[]'::json));
end;
$$;

-- ─── RPC: submit claim ──────────────────────────────────────────────────────

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
    select 1 from public.user_cluster_assignments uca
    where uca.user_id = auth.uid() and uca.role = 'CLUSTER_OWNER'
  ) then
    return json_build_object('ok', false, 'code', 'ALREADY_ASSIGNED');
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

-- ─── RPC: list my requests ──────────────────────────────────────────────────

create or replace function public.court_list_my_claim_requests()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.requested_at desc), '[]'::json) into v_rows
  from (
    select *
    from public.court_claim_requests
    where user_id = auth.uid()
    order by requested_at desc
    limit 20
  ) t;

  return json_build_object('ok', true, 'requests', coalesce(v_rows, '[]'::json));
end;
$$;

-- ─── RPC: list pending (admin) ────────────────────────────────────────────────

create or replace function public.court_list_pending_claim_requests(
  p_limit int default 50
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_rows json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.can_review_court_claim() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      r.*,
      p.email as user_email,
      p.display_name as user_display_name
    from public.court_claim_requests r
    join public.profiles p on p.id = r.user_id
    where r.status = 'pending'
    order by r.requested_at asc
    limit v_limit
  ) t;

  return json_build_object('ok', true, 'requests', coalesce(v_rows, '[]'::json));
end;
$$;

-- ─── RPC: review ────────────────────────────────────────────────────────────

create or replace function public.court_review_claim_request(
  p_request_id text,
  p_action text,
  p_review_note text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.court_claim_requests%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_cluster_id text;
  v_profile public.profiles%rowtype;
  v_sub public.tenant_subscriptions%rowtype;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.can_review_court_claim() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_row
  from public.court_claim_requests
  where id = p_request_id
  for update;

  if not found then
    return json_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND');
  end if;

  if v_row.status <> 'pending' then
    return json_build_object('ok', false, 'code', 'NOT_PENDING');
  end if;

  if v_action = 'reject' then
    update public.court_claim_requests
    set
      status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = coalesce(p_review_note, ''),
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

    return json_build_object('ok', true, 'request', row_to_json(v_row));
  end if;

  if v_action <> 'approve' then
    return json_build_object('ok', false, 'code', 'INVALID_ACTION');
  end if;

  select * into v_profile from public.profiles where id = v_row.user_id;
  if not found then
    return json_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  foreach v_cluster_id in array v_row.cluster_ids loop
    if not public.is_cluster_unassigned(v_cluster_id) then
      return json_build_object(
        'ok', false,
        'code', 'CLUSTER_NOT_AVAILABLE',
        'error', 'Cụm sân không còn trống: ' || v_cluster_id
      );
    end if;
  end loop;

  foreach v_cluster_id in array v_row.cluster_ids loop
    insert into public.user_cluster_assignments (user_id, cluster_id, role)
    values (v_row.user_id, v_cluster_id, 'CLUSTER_OWNER')
    on conflict (user_id, cluster_id) do update set role = 'CLUSTER_OWNER';

    update public.court_clusters
    set owner_user_id = v_row.user_id, updated_at = now()
    where id = v_cluster_id;
  end loop;

  if v_profile.venue_id is null then
    update public.profiles
    set
      role = 'COURT_OWNER',
      venue_id = v_row.venue_id,
      status = 'active',
      updated_at = now()
    where id = v_row.user_id;

    update public.venues
    set owner_id = v_row.user_id, updated_at = now()
    where id = v_row.venue_id
      and owner_id is null;

    begin
      v_sub := public.billing_create_trial_subscription(v_row.venue_id);
    exception
      when others then
        null;
    end;
  elsif v_profile.venue_id = v_row.venue_id and v_profile.role = 'PLAYER' then
    update public.profiles
    set role = 'COURT_OWNER', status = 'active', updated_at = now()
    where id = v_row.user_id;
  end if;

  update public.court_claim_requests
  set
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = coalesce(p_review_note, ''),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return json_build_object('ok', true, 'request', row_to_json(v_row));
exception
  when others then
    return json_build_object('ok', false, 'code', 'REVIEW_FAILED', 'error', sqlerrm);
end;
$$;

-- ─── RPC: cancel own pending ────────────────────────────────────────────────

create or replace function public.court_cancel_claim_request(p_request_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.court_claim_requests%rowtype;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  update public.court_claim_requests
  set status = 'cancelled', updated_at = now()
  where id = p_request_id
    and user_id = auth.uid()
    and status = 'pending'
  returning * into v_row;

  if not found then
    return json_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND');
  end if;

  return json_build_object('ok', true, 'request', row_to_json(v_row));
end;
$$;

grant execute on function public.is_cluster_unassigned(text) to authenticated;
grant execute on function public.can_review_court_claim() to authenticated;
grant execute on function public.court_list_unassigned_clusters(text, int) to authenticated;
grant execute on function public.court_submit_claim_request(text[], text) to authenticated;
grant execute on function public.court_list_my_claim_requests() to authenticated;
grant execute on function public.court_list_pending_claim_requests(int) to authenticated;
grant execute on function public.court_review_claim_request(text, text, text) to authenticated;
grant execute on function public.court_cancel_claim_request(text) to authenticated;
