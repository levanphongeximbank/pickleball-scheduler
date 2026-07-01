-- Phase 9 — Trial subscription RPC (additive patch)
-- Apply SAU docs/supabase-billing-phase9.sql trên staging.
-- Rollback: docs/supabase-billing-phase9-trial-rpc-rollback.sql
-- KHÔNG apply production cho đến khi Phase 10 QA xong.

-- Owner không insert trực tiếp tenant_subscriptions (RLS admin-only write).
-- RPC security definer tạo trial TRIAL an toàn khi tenant chưa có subscription.

create or replace function public.billing_create_trial_subscription(
  p_tenant_id text default null
)
returns public.tenant_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id text;
  v_existing public.tenant_subscriptions%rowtype;
  v_sub public.tenant_subscriptions%rowtype;
  v_role text;
  v_trial_days int := 14;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_role := public.user_role();

  if public.is_super_admin() then
    v_tenant_id := coalesce(nullif(trim(p_tenant_id), ''), public.user_venue_id());
  else
    v_tenant_id := public.user_venue_id();
    if p_tenant_id is not null and trim(p_tenant_id) <> v_tenant_id then
      raise exception 'access_denied: cross-tenant trial creation is not allowed';
    end if;
    if v_role not in ('COURT_OWNER', 'VENUE_OWNER', 'CLUB_OWNER') then
      raise exception 'access_denied: only tenant owner may request trial subscription';
    end if;
  end if;

  if v_tenant_id is null then
    raise exception 'tenant_required';
  end if;

  if not exists (select 1 from public.venues v where v.id = v_tenant_id) then
    raise exception 'tenant_not_found';
  end if;

  select * into v_existing
  from public.tenant_subscriptions
  where tenant_id = v_tenant_id
  order by created_at desc
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into public.tenant_subscriptions (
    id,
    tenant_id,
    plan_id,
    status,
    billing_cycle,
    start_date,
    trial_start_date,
    trial_end_date,
    auto_renew,
    created_at,
    updated_at
  ) values (
    'sub-' || replace(gen_random_uuid()::text, '-', ''),
    v_tenant_id,
    'plan-TRIAL',
    'trialing',
    'monthly',
    now(),
    now(),
    now() + make_interval(days => v_trial_days),
    true,
    now(),
    now()
  )
  returning * into v_sub;

  insert into public.billing_audit_logs (
    id,
    tenant_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    after,
    metadata,
    created_at
  ) values (
    'billing-audit-' || replace(gen_random_uuid()::text, '-', ''),
    v_tenant_id,
    auth.uid(),
    'SubscriptionCreated',
    'tenant_subscription',
    v_sub.id,
    jsonb_build_object('status', 'trialing', 'planCode', 'TRIAL'),
    jsonb_build_object('source', 'billing_create_trial_subscription'),
    now()
  );

  insert into public.billing_events (
    id,
    tenant_id,
    event_type,
    user_id,
    metadata,
    created_at
  ) values (
    'billing-event-' || replace(gen_random_uuid()::text, '-', ''),
    v_tenant_id,
    'TrialStarted',
    auth.uid(),
    jsonb_build_object('planCode', 'TRIAL', 'source', 'billing_create_trial_subscription'),
    now()
  );

  return v_sub;
end;
$$;

revoke all on function public.billing_create_trial_subscription(text) from public;
grant execute on function public.billing_create_trial_subscription(text) to authenticated;

comment on function public.billing_create_trial_subscription(text) is
  'Phase 9 — idempotent trial TRIAL subscription for owner tenant; SUPER_ADMIN may pass tenant id.';
