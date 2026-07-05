-- =============================================================================
-- Phase 19B — Promote platform founder to SUPER_ADMIN (Production)
-- Project: expuvcohlcjzvrrauvud (pickleball-scheduler-production)
-- Email: lephong.eximbank@gmail.com
--
-- Idempotent, additive only:
--   • Không xóa auth.users
--   • Không xóa venue venue-prod-main (giữ nguyên bảng venues)
--   • Founder không gắn venue_id / tenant subscription
-- Chạy: Supabase Dashboard → SQL Editor (postgres / service_role bypass guard)
-- =============================================================================

begin;

-- Snapshot trước khi sửa (owner lưu kết quả)
select 'pre_founder_profile' as snap, p.*
from public.profiles p
where p.email = 'lephong.eximbank@gmail.com';

select 'pre_founder_auth_user' as snap, u.id, u.email, u.email_confirmed_at
from auth.users u
where u.email = 'lephong.eximbank@gmail.com';

-- ─── 1) Insert profile nếu chưa có (từ auth.users) ───────────────────────────
insert into public.profiles (id, email, display_name, role, venue_id, club_id, status)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
    split_part(coalesce(u.email, 'founder'), '@', 1)
  ),
  'SUPER_ADMIN',
  null,
  null,
  'active'
from auth.users u
where u.email = 'lephong.eximbank@gmail.com'
on conflict (id) do nothing;

-- ─── 2) Update profile → SUPER_ADMIN, bỏ ràng buộc tenant ───────────────────
update public.profiles
set
  role = 'SUPER_ADMIN',
  venue_id = null,
  club_id = null,
  status = 'active',
  display_name = coalesce(
    nullif(trim(display_name), ''),
    'Platform Founder'
  ),
  updated_at = now()
where email = 'lephong.eximbank@gmail.com';

-- Fail-safe: báo nếu chưa có auth user
do $$
begin
  if not exists (
    select 1 from auth.users where email = 'lephong.eximbank@gmail.com'
  ) then
    raise exception 'AUTH_USER_MISSING: lephong.eximbank@gmail.com chưa tồn tại trong auth.users';
  end if;

  if not exists (
    select 1 from public.profiles where email = 'lephong.eximbank@gmail.com'
  ) then
    raise exception 'PROFILE_MISSING: không tạo được profile cho founder';
  end if;
end $$;

commit;

-- =============================================================================
-- Verification (chạy sau commit)
-- =============================================================================

-- V1 — Founder role + không gắn venue
select
  p.id,
  p.email,
  p.role,
  p.venue_id,
  p.club_id,
  p.status,
  case
    when p.role = 'SUPER_ADMIN' and p.venue_id is null then 'ok_founder'
    else 'CHECK'
  end as founder_check
from public.profiles p
where p.email = 'lephong.eximbank@gmail.com';

-- V2 — Venue prod vẫn tồn tại (không bị xóa)
select id, name, slug, owner_id, status
from public.venues
where id = 'venue-prod-main';

-- V3 — Founder không còn là owner_id của venue (sau promote, gán owner test riêng)
select
  v.id,
  v.owner_id,
  p.email as owner_email,
  p.role as owner_role
from public.venues v
left join public.profiles p on p.id = v.owner_id
where v.id = 'venue-prod-main';

-- V4 — Cross-tenant: founder không có subscription tenant riêng
select ts.*
from public.tenant_subscriptions ts
join public.profiles p on p.venue_id = ts.tenant_id
where p.email = 'lephong.eximbank@gmail.com';
-- expect: 0 rows
