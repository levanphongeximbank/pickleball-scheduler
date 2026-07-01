-- Pickleball Scheduler Pro v4.0 — Phase B (additive)
-- Chạy SAU docs/supabase-identity-v40-sprint1.sql
-- Rollback: docs/supabase-identity-v40-phaseB-rollback.sql

-- Mở rộng audit action types
alter table public.audit_logs drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in (
    'login', 'login_failed', 'logout',
    'create', 'update', 'delete',
    'assign_role', 'permission_change',
    'password_change', 'reset_password'
  ));

alter table public.audit_logs
  add column if not exists ip_address text default '',
  add column if not exists user_agent text default '';

-- profiles: phone/avatar đã có từ sprint1 — đảm bảo tồn tại
alter table public.profiles
  add column if not exists phone text default '',
  add column if not exists avatar_url text default '';

-- Dev password reset tokens (optional server-side; client dùng Supabase Auth recovery)
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens (user_id);

create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens (expires_at);

alter table public.password_reset_tokens enable row level security;

-- Chỉ service role / admin RPC ghi token — client dùng Supabase resetPasswordForEmail
drop policy if exists "password_reset_tokens_deny_all" on public.password_reset_tokens;
create policy "password_reset_tokens_deny_all"
  on public.password_reset_tokens for all to authenticated
  using (false)
  with check (false);
