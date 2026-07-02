-- Rollback Phase 11A Sprint 10 RLS + webhook_endpoints
-- Staging/dev only. Run before re-applying docs/supabase-sprint10-phase11a-rls.sql.

drop policy if exists webhook_endpoints_manage on public.webhook_endpoints;
drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
drop policy if exists webhook_events_manage on public.webhook_events;
drop policy if exists webhook_events_select on public.webhook_events;
drop policy if exists notification_logs_insert on public.notification_logs;
drop policy if exists notification_logs_select on public.notification_logs;
drop policy if exists payment_transactions_manage on public.payment_transactions;
drop policy if exists payment_transactions_select on public.payment_transactions;
drop policy if exists marketplace_orders_manage on public.marketplace_orders;
drop policy if exists marketplace_orders_select on public.marketplace_orders;
drop policy if exists marketplace_products_manage on public.marketplace_products;
drop policy if exists marketplace_products_select on public.marketplace_products;
drop policy if exists api_logs_insert on public.api_logs;
drop policy if exists api_logs_select on public.api_logs;
drop policy if exists api_keys_manage on public.api_keys;
drop policy if exists api_keys_select on public.api_keys;
drop policy if exists api_clients_manage on public.api_clients;
drop policy if exists api_clients_select on public.api_clients;

drop table if exists public.webhook_endpoints cascade;
