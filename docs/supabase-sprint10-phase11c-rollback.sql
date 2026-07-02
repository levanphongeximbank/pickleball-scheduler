-- Phase 11C rollback — API key guard patch

drop index if exists public.api_keys_tenant_status_idx;
drop index if exists public.api_keys_prefix_tenant_idx;

alter table public.api_keys
  drop column if exists expires_at;
