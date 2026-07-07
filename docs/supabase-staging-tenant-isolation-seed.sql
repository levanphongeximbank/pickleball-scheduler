-- =============================================================================
-- Staging Tenant Isolation QA — Seed Owner A / Owner B
-- Project: qyewbxjsiiyufanzcjcq (pickleball-scheduler staging) ONLY
--
-- Mục tiêu: Dữ liệu cloud phân biệt rõ tenant A (3 sân) vs tenant B (5 sân)
-- cho QA browser + verify-cross-tenant-rls-staging.mjs
--
-- Tiên quyết:
--   1. docs/supabase-billing-phase10e-staging-tenant-align.sql đã apply
--   2. Auth users đã đăng ký: owner@staging.local, owner-b@staging.local
--   3. docs/supabase-staging-phase10d-tenant-b-seed.sql đã align profile B
--
-- Idempotent · additive only · KHÔNG chạy production
-- =============================================================================

begin;

-- ─── 1) Venues (metadata khác nhau) ─────────────────────────────────────────

insert into public.venues (id, name, slug, status)
values
  ('venue-staging-a', 'Venue Staging A — Ông A', 'venue-staging-a', 'trial'),
  ('venue-staging-b', 'Venue Staging B — Ông B', 'venue-staging-b', 'trial')
on conflict (id) do update
set
  name = excluded.name,
  status = excluded.status,
  updated_at = now();

-- ─── 2) Align owner profiles ────────────────────────────────────────────────

update public.profiles
set
  role = 'VENUE_OWNER',
  venue_id = 'venue-staging-a',
  club_id = null,
  status = 'active',
  display_name = coalesce(nullif(trim(display_name), ''), 'Owner Staging A'),
  updated_at = now()
where email = 'owner@staging.local';

update public.profiles
set
  role = 'VENUE_OWNER',
  venue_id = 'venue-staging-b',
  club_id = null,
  status = 'active',
  display_name = coalesce(nullif(trim(display_name), ''), 'Owner Staging B'),
  updated_at = now()
where email = 'owner-b@staging.local';

-- ─── 3) Trial subscriptions (mỗi tenant riêng) ───────────────────────────────

insert into public.tenant_subscriptions (
  id,
  tenant_id,
  status,
  plan_id,
  trial_start_date,
  trial_end_date,
  end_date
)
select
  'sub-' || v.id || '-trial',
  v.id,
  'trialing',
  'plan-TRIAL',
  now(),
  now() + interval '14 days',
  now() + interval '14 days'
from public.venues v
where v.id in ('venue-staging-a', 'venue-staging-b')
  and not exists (
    select 1
    from public.tenant_subscriptions ts
    where ts.tenant_id = v.id
  );

-- ─── 4) club_data_v3 — payload phân biệt A vs B ─────────────────────────────

-- Đảm bảo cột venue_id (RLS Phase club-v3)
alter table public.club_data_v3 add column if not exists venue_id text;

insert into public.club_data_v3 (club_id, venue_id, data, synced_at)
values
  (
    'club-staging-a',
    'venue-staging-a',
    jsonb_build_object(
      'schemaVersion', 3,
      'clubId', 'club-staging-a',
      'tenantId', 'venue-staging-a',
      'venueId', 'venue-staging-a',
      'courts', jsonb_build_array(
        jsonb_build_object('id', 'court-a1', 'name', 'Sân A1', 'number', 1, 'active', true, 'tenantId', 'venue-staging-a'),
        jsonb_build_object('id', 'court-a2', 'name', 'Sân A2', 'number', 2, 'active', true, 'tenantId', 'venue-staging-a'),
        jsonb_build_object('id', 'court-a3', 'name', 'Sân A3', 'number', 3, 'active', true, 'tenantId', 'venue-staging-a')
      ),
      'leagues', jsonb_build_array(
        jsonb_build_object('id', 'league-a-internal', 'name', 'Giải A', 'type', 'internal')
      ),
      'players', jsonb_build_array(
        jsonb_build_object('id', 'player-a1', 'name', 'VĐV A1', 'tenantId', 'venue-staging-a')
      )
    ),
    now()
  ),
  (
    'club-staging-b',
    'venue-staging-b',
    jsonb_build_object(
      'schemaVersion', 3,
      'clubId', 'club-staging-b',
      'tenantId', 'venue-staging-b',
      'venueId', 'venue-staging-b',
      'courts', jsonb_build_array(
        jsonb_build_object('id', 'court-b1', 'name', 'Sân B1', 'number', 1, 'active', true, 'tenantId', 'venue-staging-b'),
        jsonb_build_object('id', 'court-b2', 'name', 'Sân B2', 'number', 2, 'active', true, 'tenantId', 'venue-staging-b'),
        jsonb_build_object('id', 'court-b3', 'name', 'Sân B3', 'number', 3, 'active', true, 'tenantId', 'venue-staging-b'),
        jsonb_build_object('id', 'court-b4', 'name', 'Sân B4', 'number', 4, 'active', true, 'tenantId', 'venue-staging-b'),
        jsonb_build_object('id', 'court-b5', 'name', 'Sân B5', 'number', 5, 'active', true, 'tenantId', 'venue-staging-b')
      ),
      'leagues', jsonb_build_array(
        jsonb_build_object('id', 'league-b-internal', 'name', 'Giải B', 'type', 'internal')
      ),
      'players', jsonb_build_array(
        jsonb_build_object('id', 'player-b1', 'name', 'VĐV B1', 'tenantId', 'venue-staging-b')
      )
    ),
    now()
  )
on conflict (club_id) do update
set
  venue_id = excluded.venue_id,
  data = excluded.data,
  synced_at = now();

-- ─── 5) Verify ──────────────────────────────────────────────────────────────

select 'venues' as section, id, name, status
from public.venues
where id in ('venue-staging-a', 'venue-staging-b')
order by id;

select 'profiles' as section, email, role, venue_id, status
from public.profiles
where email in ('owner@staging.local', 'owner-b@staging.local')
order by email;

select 'subscriptions' as section, tenant_id, status, plan_id
from public.tenant_subscriptions
where tenant_id in ('venue-staging-a', 'venue-staging-b')
order by tenant_id;

select
  'club_data_v3' as section,
  club_id,
  venue_id,
  jsonb_array_length(coalesce(data->'courts', '[]'::jsonb)) as court_count,
  data->'leagues'->0->>'name' as league_name
from public.club_data_v3
where club_id in ('club-staging-a', 'club-staging-b')
order by club_id;

commit;

-- Rollback (khẩn cấp — chỉ xóa seed QA, không xóa venues/users):
-- delete from public.club_data_v3 where club_id in ('club-staging-a', 'club-staging-b');
