create extension if not exists pgcrypto;

create table if not exists v5_tenants (
  id text primary key,
  tenant_id text unique not null,
  name text not null,
  plan text default 'trial',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists v5_users (
  id text primary key,
  user_id text unique not null,
  email text not null,
  role text default 'PLAYER',
  tenant_id text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists v5_subscriptions (
  id text primary key,
  tenant_id text unique not null,
  plan text default 'trial',
  status text default 'active',
  feature_flags jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists v5_audit_logs (
  id text primary key,
  tenant_id text not null,
  actor_user_id text,
  action text not null,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists v5_notifications (
  id text primary key,
  tenant_id text not null,
  user_id text,
  channel text default 'email',
  title text not null,
  body text default '',
  created_at timestamptz default now()
);

create table if not exists v5_settings (
  id text primary key,
  tenant_id text not null,
  scope text default 'tenant',
  key text not null,
  value jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_v5_users_tenant_id on v5_users(tenant_id);
create index if not exists idx_v5_audit_logs_tenant_id on v5_audit_logs(tenant_id);
create index if not exists idx_v5_notifications_tenant_id on v5_notifications(tenant_id);
create index if not exists idx_v5_settings_tenant_id_key on v5_settings(tenant_id, key);

alter table v5_users enable row level security;
alter table v5_audit_logs enable row level security;
alter table v5_notifications enable row level security;
alter table v5_settings enable row level security;

create policy if not exists v5_users_tenant_isolation on v5_users
  for all using (tenant_id = current_setting('app.tenant_id', true));

create policy if not exists v5_audit_logs_tenant_isolation on v5_audit_logs
  for select using (tenant_id = current_setting('app.tenant_id', true));

create policy if not exists v5_notifications_tenant_isolation on v5_notifications
  for all using (tenant_id = current_setting('app.tenant_id', true));

create policy if not exists v5_settings_tenant_isolation on v5_settings
  for all using (tenant_id = current_setting('app.tenant_id', true));
