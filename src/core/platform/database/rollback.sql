drop policy if exists v5_users_tenant_isolation on v5_users;
drop policy if exists v5_audit_logs_tenant_isolation on v5_audit_logs;
drop policy if exists v5_notifications_tenant_isolation on v5_notifications;
drop policy if exists v5_settings_tenant_isolation on v5_settings;

drop table if exists v5_settings;
drop table if exists v5_notifications;
drop table if exists v5_audit_logs;
drop table if exists v5_subscriptions;
drop table if exists v5_users;
drop table if exists v5_tenants;
