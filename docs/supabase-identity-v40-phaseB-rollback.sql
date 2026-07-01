-- Rollback v4.0 Phase B (additive)
drop table if exists public.password_reset_tokens;

alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in (
    'login', 'logout', 'create', 'update', 'delete',
    'assign_role', 'permission_change'
  ));

-- alter table public.audit_logs drop column if exists ip_address;
-- alter table public.audit_logs drop column if exists user_agent;
