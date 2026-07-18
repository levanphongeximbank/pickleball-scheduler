-- =====================================================================
-- PHASE 1B — READ-ONLY Staging investigation queries (audit constraint)
-- Run on Staging qyewbxjsiiyufanzcjcq ONLY. No DML.
-- =====================================================================

-- 1) Current constraint definition
select pg_get_constraintdef(c.oid) as audit_logs_action_check_def
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'audit_logs'
  and c.conname = 'audit_logs_action_check';

-- 2) Distinct actions currently stored
select action, count(*)::bigint as row_count
from public.audit_logs
group by action
order by action;

-- 3) Actions that the FAILED fixed 45A.3C IN-list would reject (23514 root cause)
--    (list mirrors the constraint that shipped in PHASE_45A3C before the fix)
with fixed_45a3c(action) as (
  values
    ('login'), ('login_failed'), ('logout'),
    ('create'), ('update'), ('delete'),
    ('assign_role'), ('permission_change'),
    ('password_change'), ('reset_password'),
    ('club.create'), ('club.update'), ('club.leave_membership'), ('club.delete'),
    ('club.membership_request.submit'),
    ('club.membership_request.review'),
    ('club.membership_request.correction'),
    ('club.assign_owner'), ('club.clear_owner'), ('club.transfer_president'),
    ('club.owner.transfer'), ('club.president.transfer'),
    ('club.vice_president.assign')
),
existing as (
  select distinct action from public.audit_logs where action is not null
)
select e.action as incompatible_with_fixed_45a3c
from existing e
left join fixed_45a3c f on f.action = e.action
where f.action is null
order by 1;

-- 4) Partial-apply probes for file 1 (45A.3C)
select
  to_regprocedure('public.club_update(uuid, text, integer, text, text, text, text, text)') is not null
    as club_update_exists,
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'audit_logs'
      and c.conname = 'audit_logs_action_check'
  ) as audit_constraint_exists;
