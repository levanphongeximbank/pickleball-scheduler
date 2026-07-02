-- Rollback Phase 11B persistence tables
-- Staging/dev only.

drop policy if exists integration_audit_logs_manage_admin on public.integration_audit_logs;
drop policy if exists integration_audit_logs_insert on public.integration_audit_logs;
drop policy if exists integration_audit_logs_select on public.integration_audit_logs;
drop table if exists public.integration_audit_logs cascade;

drop policy if exists tenant_integration_settings_manage on public.tenant_integration_settings;
drop policy if exists tenant_integration_settings_select on public.tenant_integration_settings;
drop table if exists public.tenant_integration_settings cascade;
