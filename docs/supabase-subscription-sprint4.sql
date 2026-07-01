-- Subscription Sprint 4 — mở rộng plan_id + status expired
-- Chạy trên staging SAU docs/supabase-rbac.sql hoặc sprint2 SQL.

alter table public.subscriptions drop constraint if exists subscriptions_plan_id_check;
alter table public.subscriptions add constraint subscriptions_plan_id_check
  check (plan_id in ('trial', 'starter', 'professional', 'enterprise', 'basic', 'pro'));

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trial', 'active', 'past_due', 'expired', 'cancelled'));

-- Migrate legacy plan ids (optional, idempotent)
update public.subscriptions set plan_id = 'starter' where plan_id = 'basic';
update public.subscriptions set plan_id = 'professional' where plan_id = 'pro';

-- Auto-renew flag (server-side cron / Edge Function sẽ dùng sau)
alter table public.subscriptions add column if not exists auto_renew boolean not null default true;
alter table public.subscriptions add column if not exists locked_at timestamptz;
alter table public.subscriptions add column if not exists last_renewed_at timestamptz;
