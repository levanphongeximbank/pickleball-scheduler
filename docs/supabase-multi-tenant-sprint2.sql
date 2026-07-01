-- Sprint 2 — Multi Tenant (Pickleball Scheduler Pro v4.0)
-- Chạy SAU docs/supabase-rbac.sql (bảng public.venues đã tồn tại).
-- App layer: tenantId === venueId (alias). Không duplicate bảng tenant riêng.

-- View alias cho SUPER_ADMIN / reporting
create or replace view public.tenants as
select
  v.id,
  v.name,
  v.slug,
  v.owner_id as owner_user_id,
  v.timezone,
  v.status,
  coalesce(s.plan_id, 'trial') as plan,
  v.note,
  v.created_at,
  v.updated_at
from public.venues v
left join lateral (
  select plan_id
  from public.subscriptions
  where venue_id = v.id
  order by created_at desc
  limit 1
) s on true;

comment on view public.tenants is
  'Sprint 2 alias — tenant = venue. App đọc/ghi qua venues + profiles.venue_id.';

-- Mở rộng status venue (additive — giữ trial/active/suspended)
alter table public.venues drop constraint if exists venues_status_check;
alter table public.venues add constraint venues_status_check
  check (status in ('active', 'inactive', 'trial', 'suspended'));

-- club_data_v3: đảm bảo index venue (đã có trong supabase-rbac.sql)
create index if not exists club_data_v3_venue_id_idx on public.club_data_v3 (venue_id);

-- Gợi ý RLS: user chỉ pull club_data_v3 cùng venue_id profile (đã có trong club-v3-rls nếu đã chạy)
