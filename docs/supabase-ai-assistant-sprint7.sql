-- Sprint 7 — AI Assistant suggestions (staging only, chưa deploy production)
-- Apply trong Supabase SQL Editor khi bật VITE_ENABLE_AI_ENGINE=true

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  type text not null check (type in (
    'seed', 'pairing', 'group', 'time_prediction', 'schedule_validation', 'rule_suggestion'
  )),
  status text not null default 'pending' check (status in (
    'pending', 'applied', 'dismissed', 'expired'
  )),
  input_snapshot jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
  created_by text,
  created_at timestamptz not null default now(),
  applied_by text,
  applied_at timestamptz,
  dismissed_by text,
  dismissed_at timestamptz,
  expires_at timestamptz
);

create index if not exists ai_suggestions_tenant_tournament_idx
  on public.ai_suggestions (tenant_id, tournament_id);

create index if not exists ai_suggestions_status_idx
  on public.ai_suggestions (status) where status = 'pending';

alter table public.ai_suggestions enable row level security;

drop policy if exists ai_suggestions_tenant_select on public.ai_suggestions;
drop policy if exists ai_suggestions_tenant_insert on public.ai_suggestions;
drop policy if exists ai_suggestions_tenant_update on public.ai_suggestions;

-- Tenant isolation: chỉ user thuộc tenant mới đọc/ghi
create policy ai_suggestions_tenant_select on public.ai_suggestions
  for select using (
    tenant_id = coalesce(
      current_setting('request.jwt.claims', true)::json->>'tenant_id',
      current_setting('app.tenant_id', true)
    )
  );

create policy ai_suggestions_tenant_insert on public.ai_suggestions
  for insert with check (
    tenant_id = coalesce(
      current_setting('request.jwt.claims', true)::json->>'tenant_id',
      current_setting('app.tenant_id', true)
    )
  );

create policy ai_suggestions_tenant_update on public.ai_suggestions
  for update using (
    tenant_id = coalesce(
      current_setting('request.jwt.claims', true)::json->>'tenant_id',
      current_setting('app.tenant_id', true)
    )
  );
