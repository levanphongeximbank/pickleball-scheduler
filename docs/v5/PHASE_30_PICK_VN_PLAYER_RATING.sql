-- Phase 30 — Pick_VN Player Rating & Skill Verification
-- Chạy SAU: supabase-identity-v40-phaseB.sql, PHASE_22_CLOUD_PERSISTENCE.sql
-- Staging: qyewbxjsiiyufanzcjcq | Production: expuvcohlcjzvrrauvud

-- ─── Permissions (Pick_VN rating) ─────────────────────────────────
insert into public.permissions (id, module, action, description)
values
  ('skill_level.view_private', 'skill_level', 'view', 'Xem trình độ VĐV'),
  ('skill_level.request_change', 'skill_level', 'request_change', 'VĐV yêu cầu đổi trình'),
  ('skill_level.approve', 'skill_level', 'approve', 'Admin duyệt trình độ'),
  ('skill_level.verify_club', 'skill_level', 'verify', 'CLB xác thực trình'),
  ('skill_level.verify_tournament', 'skill_level', 'verify', 'BTC xác thực trình giải')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in (
  'SUPER_ADMIN', 'SYSTEM_TECHNICIAN', 'CLUB_OWNER', 'CLUB_MANAGER', 'VENUE_OWNER', 'VENUE_MANAGER'
)
  and p.id in ('skill_level.view_private', 'skill_level.approve', 'skill_level.verify_club')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in ('SUPER_ADMIN', 'SYSTEM_TECHNICIAN', 'TOURNAMENT_MANAGER', 'VENUE_OWNER', 'VENUE_MANAGER')
  and p.id = 'skill_level.verify_tournament'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id = 'PLAYER'
  and p.id in ('skill_level.view_private', 'skill_level.request_change')
on conflict do nothing;

-- ─── Table ───────────────────────────────────────────────────────
create table if not exists public.pick_vn_player_ratings (
  id text primary key,
  auth_user_id uuid not null references public.profiles (id) on delete cascade,
  vpr_athlete_id text,
  self_declared_rating numeric(3, 1),
  provisional_rating numeric(3, 1),
  verified_rating numeric(3, 1),
  current_rating numeric(3, 1) not null default 3.5,
  rating_status text not null default 'unrated'
    check (rating_status in (
      'unrated',
      'self_declared',
      'provisional',
      'club_verified',
      'admin_verified',
      'system_verified',
      'under_review',
      'rejected'
    )),
  rating_confidence numeric(4, 3) not null default 0,
  rating_match_count integer not null default 0,
  last_rating_updated_at timestamptz,
  rating_verified_by uuid references public.profiles (id) on delete set null,
  rating_verification_note text not null default '',
  rating_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id)
);

create index if not exists pick_vn_player_ratings_auth_user_id_idx
  on public.pick_vn_player_ratings (auth_user_id);

create index if not exists pick_vn_player_ratings_status_idx
  on public.pick_vn_player_ratings (rating_status);

alter table public.pick_vn_player_ratings enable row level security;

create policy pick_vn_ratings_select_self
  on public.pick_vn_player_ratings
  for select
  using (auth.uid() = auth_user_id);

create policy pick_vn_ratings_select_platform
  on public.pick_vn_player_ratings
  for select
  using (public.is_super_admin());

create policy pick_vn_ratings_upsert_self
  on public.pick_vn_player_ratings
  for all
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy pick_vn_ratings_manage_platform
  on public.pick_vn_player_ratings
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- RPC: sync rating row from client
create or replace function public.pick_vn_sync_rating(p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_row jsonb;
begin
  if v_auth is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;

  if coalesce(p_row->>'authUserId', p_row->>'auth_user_id')::uuid is distinct from v_auth
     and not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.pick_vn_player_ratings (
    id,
    auth_user_id,
    vpr_athlete_id,
    self_declared_rating,
    provisional_rating,
    verified_rating,
    current_rating,
    rating_status,
    rating_confidence,
    rating_match_count,
    last_rating_updated_at,
    rating_verified_by,
    rating_verification_note,
    rating_history,
    updated_at
  ) values (
    coalesce(p_row->>'id', 'pvn-rating-' || v_auth::text),
    coalesce((p_row->>'authUserId')::uuid, (p_row->>'auth_user_id')::uuid, v_auth),
    nullif(p_row->>'vprAthleteId', ''),
    nullif(p_row->>'selfDeclaredRating', '')::numeric,
    nullif(p_row->>'provisionalRating', '')::numeric,
    nullif(p_row->>'verifiedRating', '')::numeric,
    coalesce(nullif(p_row->>'currentRating', '')::numeric, 3.5),
    coalesce(p_row->>'ratingStatus', 'self_declared'),
    coalesce(nullif(p_row->>'ratingConfidence', '')::numeric, 0),
    coalesce(nullif(p_row->>'ratingMatchCount', '')::integer, 0),
    coalesce((p_row->>'lastRatingUpdatedAt')::timestamptz, now()),
    nullif(p_row->>'ratingVerifiedBy', '')::uuid,
    coalesce(p_row->>'ratingVerificationNote', ''),
    coalesce(p_row->'ratingHistory', '[]'::jsonb),
    now()
  )
  on conflict (auth_user_id) do update set
    vpr_athlete_id = excluded.vpr_athlete_id,
    self_declared_rating = excluded.self_declared_rating,
    provisional_rating = excluded.provisional_rating,
    verified_rating = excluded.verified_rating,
    current_rating = excluded.current_rating,
    rating_status = excluded.rating_status,
    rating_confidence = excluded.rating_confidence,
    rating_match_count = excluded.rating_match_count,
    last_rating_updated_at = excluded.last_rating_updated_at,
    rating_verified_by = excluded.rating_verified_by,
    rating_verification_note = excluded.rating_verification_note,
    rating_history = excluded.rating_history,
    updated_at = now();

  select to_jsonb(r.*) into v_row
  from public.pick_vn_player_ratings r
  where r.auth_user_id = coalesce((p_row->>'authUserId')::uuid, (p_row->>'auth_user_id')::uuid, v_auth);

  return jsonb_build_object('ok', true, 'record', v_row);
end;
$$;

create or replace function public.pick_vn_get_rating_by_auth_user(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if auth.uid() is distinct from p_auth_user_id and not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select to_jsonb(r.*) into v_row
  from public.pick_vn_player_ratings r
  where r.auth_user_id = p_auth_user_id;

  return jsonb_build_object('ok', true, 'record', v_row);
end;
$$;

create or replace function public.pick_vn_verify_rating(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  return public.pick_vn_sync_rating(p_payload);
end;
$$;

create or replace function public.pick_vn_list_pending_verifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.updated_at desc), '[]'::jsonb)
  into v_rows
  from public.pick_vn_player_ratings r
  where r.rating_status in ('under_review', 'provisional');

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

grant execute on function public.pick_vn_sync_rating(jsonb) to authenticated;
grant execute on function public.pick_vn_get_rating_by_auth_user(uuid) to authenticated;
grant execute on function public.pick_vn_verify_rating(jsonb) to authenticated;
grant execute on function public.pick_vn_list_pending_verifications() to authenticated;
