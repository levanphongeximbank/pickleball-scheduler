-- Rollback Phase 9 billing tables (destructive — staging only)
drop table if exists public.billing_audit_logs cascade;
drop table if exists public.billing_events cascade;
drop table if exists public.payments cascade;
drop table if exists public.invoice_items cascade;
drop table if exists public.invoices cascade;
drop table if exists public.tenant_subscriptions cascade;
drop table if exists public.plan_limits cascade;
drop table if exists public.plans cascade;
