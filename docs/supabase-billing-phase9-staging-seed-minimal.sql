-- Phase 9 Billing — minimal staging seed (reference only)
-- Chạy trên Supabase staging khi thiếu venue/profile/subscription alignment.
-- KHÔNG apply production. Điều chỉnh UUID/email/venue id theo project thật.

-- 1) Kiểm tra alignment hiện tại
select p.id, p.email, p.role, p.venue_id, v.name as venue_name
from public.profiles p
left join public.venues v on v.id = p.venue_id
order by p.email;

select ts.tenant_id, ts.status, ts.plan_id, ts.trial_start_date, ts.trial_end_date
from public.tenant_subscriptions ts
order by ts.created_at desc;

-- 2) Venue mẫu (bỏ qua nếu đã có)
insert into public.venues (id, name, slug, status)
values ('venue-staging-demo', 'Staging Demo Venue', 'staging-demo', 'trial')
on conflict (id) do nothing;

-- 3) Gán venue cho COURT_OWNER (thay YOUR_OWNER_USER_UUID)
-- update public.profiles
-- set venue_id = 'venue-staging-demo', updated_at = now()
-- where id = 'YOUR_OWNER_USER_UUID'::uuid and role in ('COURT_OWNER', 'VENUE_OWNER', 'CLUB_OWNER');

-- 4) Trial subscription — khuyến nghị dùng RPC (owner-safe), không insert trực tiếp:
-- select public.billing_create_trial_subscription('venue-staging-demo');
-- (chạy trong app đã đăng nhập owner, hoặc SQL Editor với JWT owner)

-- 5) Verify plans seed (expect 4)
select code, name from public.plans order by sort_order;
select plan_id, max_courts from public.plan_limits;
