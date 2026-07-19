-- =====================================================================
-- PHASE 1B — ADDITIVE audit_logs_action_check (STAGING FIRST)
-- =====================================================================
--
-- Root cause of 45A.3C apply failure (23514):
--   DROP + ADD constraint with a fixed IN-list that is NOT a superset of
--   every action value already present in public.audit_logs on Staging.
--   Postgres validates existing rows when ADD CONSTRAINT runs.
--
-- This migration is intentionally data-preserving and additive:
--   1) Collect DISTINCT action values already stored in audit_logs
--   2) UNION with the known Phase 1B + historical identity/club whitelist
--   3) DROP + ADD constraint using that UNION only
--   → never rejects historical rows; never truncates; no DML on row data
--
-- Idempotent: safe to re-run; result is the union of current rows + known set.
-- Does not weaken RLS. Does not delete audit history.
--
-- Production: NOT APPLIED from this branch. Staging first.
-- =====================================================================

do $$
declare
  v_list text;
  v_sql text;
begin
  select string_agg(quote_literal(a), ', ' order by a)
    into v_list
  from (
    -- Historical rows already on this database (must never be excluded)
    select distinct action as a
    from public.audit_logs
    where action is not null
      and length(trim(action)) > 0

    union

    -- Known identity / club / Phase 1B actions (may not yet exist as rows)
    select unnest(array[
      -- Identity / admin (identity Phase B + client AUDIT_ACTIONS)
      'login',
      'login_failed',
      'logout',
      'create',
      'update',
      'delete',
      'assign_role',
      'permission_change',
      'password_change',
      'reset_password',
      'pairing_override',
      'group_override',
      -- Club lifecycle
      'club.create',
      'club.update',
      'club.leave_membership',
      'club.delete',
      -- Membership requests
      'club.membership_request.submit',
      'club.membership_request.review',
      'club.membership_request.correction',
      'club.membership_request.cancel',
      -- Member commands (Phase 45A.4C / 45A.4D / 1B)
      'club.member.add',
      'club.member.remove',
      'club.member.restore',
      -- Governance RPC
      'club.assign_owner',
      'club.clear_owner',
      'club.transfer_president',
      'club.assign_vice_president',
      'club.clear_vice_president',
      -- Governance client bridge
      'club.owner.transfer',
      'club.president.transfer',
      'club.vice_president.assign',
      -- Common client audit strings observed in app code (defensive)
      'rating.verify',
      'rating.propose',
      'audit.view',
      'workflow.notification',
      'user.manage.denied',
      'user.manage.status-change',
      'payment_success',
      'approve'
    ]::text[])
  ) s;

  if v_list is null or v_list = '' then
    raise exception 'PHASE_1B_AUDIT_WHITELIST: empty action set — aborting';
  end if;

  alter table public.audit_logs drop constraint if exists audit_logs_action_check;

  v_sql := format(
    'alter table public.audit_logs add constraint audit_logs_action_check check (action in (%s))',
    v_list
  );
  execute v_sql;
end
$$;

-- =====================================================================
-- END — PHASE 1B additive audit whitelist
-- Production deployment status: NOT APPLIED
-- =====================================================================
