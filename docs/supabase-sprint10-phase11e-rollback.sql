-- Rollback Phase 11E — integration_audit_logs indexes only
-- Staging/dev only. Does not drop table or Phase 11E columns (destructive).
-- Full table rollback: docs/supabase-sprint10-phase11b-rollback.sql

drop index if exists public.integration_audit_logs_key_prefix_created_at_idx;
drop index if exists public.integration_audit_logs_event_created_at_idx;
drop index if exists public.integration_audit_logs_request_id_idx;
drop index if exists public.integration_audit_logs_tenant_created_at_idx;
drop index if exists public.integration_audit_logs_created_at_idx;
