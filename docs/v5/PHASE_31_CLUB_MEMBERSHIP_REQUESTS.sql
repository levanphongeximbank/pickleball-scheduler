-- Phase 31 — Club membership requests (athlete join + president/VP approve)
-- Chạy SAU: supabase-club-governance-v52.sql, supabase-rbac-v4.sql
-- Spec: docs/v5/CLUB_GOVERNANCE_SPEC.md

create table if not exists public.club_membership_requests (
  id text primary key,
  venue_id text not null,
  club_id text not null references public.club_governance(club_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  pick_vn_rating numeric,
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  approved_player_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create index if not exists club_membership_requests_club_status_idx
  on public.club_membership_requests (club_id, status);

create index if not exists club_membership_requests_user_idx
  on public.club_membership_requests (user_id);

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.can_review_club_membership_for(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.is_club_owner_for(p_club_id)
    or public.is_club_president_for(p_club_id)
    or exists (
      select 1 from public.club_governance g
      where g.club_id = p_club_id
        and g.vice_president_user_id = auth.uid()
    );
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.club_membership_requests enable row level security;

drop policy if exists "club_membership_requests_select" on public.club_membership_requests;
drop policy if exists "club_membership_requests_insert" on public.club_membership_requests;
drop policy if exists "club_membership_requests_update" on public.club_membership_requests;

create policy "club_membership_requests_select"
  on public.club_membership_requests
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.can_review_club_membership_for(club_id)
    or public.is_super_admin()
  );

create policy "club_membership_requests_insert"
  on public.club_membership_requests
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.club_governance g
      where g.club_id = club_membership_requests.club_id
        and g.status = 'active'
        and g.venue_id = public.user_venue_id()
    )
    and coalesce(public.user_club_id(), '') = ''
  );

create policy "club_membership_requests_update"
  on public.club_membership_requests
  for update
  to authenticated
  using (
    (user_id = auth.uid() and status = 'pending')
    or public.can_review_club_membership_for(club_id)
  )
  with check (true);

-- ─── RPC: submit ────────────────────────────────────────────────────────────

create or replace function public.club_submit_membership_request(
  p_club_id text,
  p_message text default '',
  p_pick_vn_rating numeric default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.profiles%rowtype;
  v_gov public.club_governance%rowtype;
  v_id text;
  v_row public.club_membership_requests%rowtype;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  select * into v_user from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  if coalesce(v_user.club_id, '') <> '' then
    return json_build_object('ok', false, 'code', 'ALREADY_IN_CLUB');
  end if;

  select * into v_gov from public.club_governance where club_id = p_club_id;
  if not found or v_gov.status <> 'active' then
    return json_build_object('ok', false, 'code', 'CLUB_NOT_ACTIVE');
  end if;

  if v_gov.venue_id is distinct from v_user.venue_id then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không cùng venue');
  end if;

  v_id := 'cmr-' || p_club_id || '-' || auth.uid()::text;

  insert into public.club_membership_requests (
    id, venue_id, club_id, user_id, display_name, pick_vn_rating, message, status
  ) values (
    v_id,
    v_gov.venue_id,
    p_club_id,
    auth.uid(),
    coalesce(v_user.display_name, ''),
    p_pick_vn_rating,
    coalesce(p_message, ''),
    'pending'
  )
  on conflict (club_id, user_id) do update
  set
    display_name = excluded.display_name,
    pick_vn_rating = excluded.pick_vn_rating,
    message = excluded.message,
    status = 'pending',
    requested_at = now(),
    reviewed_by = null,
    reviewed_at = null,
    review_note = '',
    approved_player_id = null,
    updated_at = now()
  where public.club_membership_requests.status in ('rejected', 'cancelled')
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.club_membership_requests where club_id = p_club_id and user_id = auth.uid();
    if v_row.status = 'pending' then
      return json_build_object('ok', false, 'code', 'DUPLICATE_PENDING');
    end if;
    return json_build_object('ok', false, 'code', 'REQUEST_EXISTS');
  end if;

  return json_build_object('ok', true, 'request', row_to_json(v_row));
exception
  when others then
    return json_build_object('ok', false, 'code', 'SUBMIT_FAILED', 'error', sqlerrm);
end;
$$;

-- ─── RPC: review (approve links profile; player blob remains client-side V1) ─

create or replace function public.club_review_membership_request(
  p_user_id uuid,
  p_club_id text,
  p_player_id text,
  p_action text,
  p_review_note text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_membership_requests%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.can_review_club_membership_for(p_club_id) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_row
  from public.club_membership_requests
  where club_id = p_club_id and user_id = p_user_id
  for update;

  if not found then
    return json_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND');
  end if;

  if v_row.status <> 'pending' then
    return json_build_object('ok', false, 'code', 'NOT_PENDING');
  end if;

  if v_action = 'approve' then
    if coalesce(p_player_id, '') = '' then
      return json_build_object('ok', false, 'code', 'MISSING_PLAYER_ID');
    end if;

    update public.profiles
    set club_id = p_club_id, player_id = p_player_id, updated_at = now()
    where id = p_user_id;

    update public.club_membership_requests
    set
      status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = coalesce(p_review_note, ''),
      approved_player_id = p_player_id,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

    return json_build_object('ok', true, 'request', row_to_json(v_row));
  elsif v_action = 'reject' then
    update public.club_membership_requests
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

  return json_build_object('ok', false, 'code', 'INVALID_ACTION');
exception
  when others then
    return json_build_object('ok', false, 'code', 'REVIEW_FAILED', 'error', sqlerrm);
end;
$$;

grant execute on function public.club_submit_membership_request(text, text, numeric) to authenticated;
grant execute on function public.club_review_membership_request(uuid, text, text, text, text) to authenticated;
