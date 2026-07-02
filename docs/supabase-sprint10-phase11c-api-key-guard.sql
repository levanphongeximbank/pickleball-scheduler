-- Phase 11C — API key guard staging patch (expires_at column)
-- Apply on staging only. Do NOT apply production.

alter table public.api_keys
  add column if not exists expires_at timestamptz;

comment on column public.api_keys.expires_at is
  'Optional expiry timestamp. Status may also be set to expired.';

create index if not exists api_keys_prefix_tenant_idx
  on public.api_keys (key_prefix, tenant_id);

create index if not exists api_keys_tenant_status_idx
  on public.api_keys (tenant_id, status);
