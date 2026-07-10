-- Phase 42I.1 — Production QA data cleanup (DO NOT apply until GO DEPLOY 42I.1)
-- Reverts erroneous SA approve of request 7a498187; keeps Hoàng active + 69e67a8f rejected.
--
-- club_members.status is constrained by club_members_status_check (Phase 42B):
--   allowed: active | left | removed
--   NOT allowed: inactive
-- Use status = 'removed' to deactivate a member created by an erroneous approve.

-- ---------------------------------------------------------------------------
-- Baseline snapshot (run before cleanup)
-- ---------------------------------------------------------------------------
-- select count(*) filter (where status='active') as active_members,
--        count(*) filter (where status='pending') as pending_requests
-- from (
--   select status from club_members where club_id='club-219e4a7cbd73437eb6271f02a53314c3'
--   union all
--   select status from club_membership_requests_v42 where club_id='club-219e4a7cbd73437eb6271f02a53314c3'
-- ) s;

begin;

-- 1) Deactivate member created by erroneous SA approve (removed, not inactive — see header)
update public.club_members
set status = 'removed', version = version + 1
where id = 'e3e07720-32dd-4dcf-91c2-d82fc5b8e8a4'
  and club_id = 'club-219e4a7cbd73437eb6271f02a53314c3'
  and user_id = '9182a06e-c14f-4dde-ab07-cc998b1b7cb5'
  and status = 'active';

-- 2) Revert request 7a498187 to pending (remove SA review)
update public.club_membership_requests_v42
set
  status = 'pending',
  reviewed_by = null,
  reviewed_at = null,
  review_note = '[42I1 cleanup] reverted erroneous SA approve during smoke QA',
  version = version + 1
where id = '7a498187-b5ad-4301-9e92-051ca6c510d1'
  and club_id = 'club-219e4a7cbd73437eb6271f02a53314c3'
  and user_id = '9182a06e-c14f-4dde-ab07-cc998b1b7cb5';

-- 3) Audit correction (system actor via service role session)
insert into public.audit_logs (
  actor_id,
  actor_email,
  action,
  resource_type,
  resource_id,
  venue_id,
  club_id,
  metadata
)
select
  '6dd85e98-e493-4e04-9582-d904e27b3a44'::uuid,
  coalesce(p.email, 'lephong.eximbank@gmail.com'),
  'club.membership_request.correction',
  'club_membership_request',
  '7a498187-b5ad-4301-9e92-051ca6c510d1',
  'venue-prod-main',
  'club-219e4a7cbd73437eb6271f02a53314c3',
  jsonb_build_object(
    'tenant_id', 'venue-prod-main',
    'club_id', 'club-219e4a7cbd73437eb6271f02a53314c3',
    'request_id', '7a498187-b5ad-4301-9e92-051ca6c510d1',
    'reviewer_user_id', '6dd85e98-e493-4e04-9582-d904e27b3a44',
    'review_action', 'correction',
    'before_data', jsonb_build_object(
      'request_status', 'approved',
      'member_id', 'e3e07720-32dd-4dcf-91c2-d82fc5b8e8a4',
      'member_status', 'active'
    ),
    'after_data', jsonb_build_object(
      'request_status', 'pending',
      'member_status', 'removed'
    ),
    'created_at', now(),
    'reason', 'Phase 42I smoke QA — revert SA approve without governance'
  )
from public.profiles p
where p.id = '6dd85e98-e493-4e04-9582-d904e27b3a44';

commit;

-- After snapshot:
-- select r.id, r.status, cm.id as member_id, cm.status as member_status
-- from club_membership_requests_v42 r
-- left join club_members cm on cm.user_id=r.user_id and cm.club_id=r.club_id and cm.status='active'
-- where r.club_id='club-219e4a7cbd73437eb6271f02a53314c3'
-- order by r.created_at;
