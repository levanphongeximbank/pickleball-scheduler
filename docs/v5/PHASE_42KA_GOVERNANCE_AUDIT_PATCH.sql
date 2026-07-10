-- Phase 42KA — Governance audit_logs_action_check patch (STAGING ONLY)
-- Root cause: club_assign_owner / club_transfer_president RPCs write audit actions
-- not whitelisted after Phase 42I.1 hotfix.
-- No RPC/business logic changes — constraint only.
-- Rollback: re-apply PHASE_42I1_MEMBERSHIP_REVIEW_HOTFIX.sql section 1

alter table public.audit_logs drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in (
    -- Identity / admin
    'login', 'login_failed', 'logout',
    'create', 'update', 'delete',
    'assign_role', 'permission_change',
    'password_change', 'reset_password',
    -- Phase 42 club lifecycle (RPC + client)
    'club.create',
    'club.leave_membership',
    'club.delete',
    -- Membership requests
    'club.membership_request.submit',
    'club.membership_request.review',
    'club.membership_request.correction',
    -- Governance (RPC canonical)
    'club.assign_owner',
    'club.clear_owner',
    'club.transfer_president',
    -- Governance (client audit bridge — legacy V1 paths)
    'club.owner.transfer',
    'club.president.transfer',
    'club.vice_president.assign'
  ));
