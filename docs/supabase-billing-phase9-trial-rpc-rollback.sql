-- Rollback Phase 9 trial subscription RPC
drop function if exists public.billing_create_trial_subscription(text);
