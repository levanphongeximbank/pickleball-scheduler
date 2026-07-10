-- Phase 42J.1 — Staging QA seed (no Production changes)
-- Run AFTER PHASE_42I1_MEMBERSHIP_REVIEW_HOTFIX.sql on staging only.

-- PLAYER without active membership (QA case 1)
-- cashier@staging.local — CASHIER role, 0 club_members active

-- Ensure admin@staging.local has NO active membership (QA case 4 — SUPER_ADMIN)
update public.club_members
set status = 'removed', updated_at = now()
where user_id = '4c3c0474-563d-43ff-8cda-63365094a785'
  and status = 'active';

delete from public.club_governance_assignments g
using public.club_members cm
where g.club_member_id = cm.id
  and cm.user_id = '4c3c0474-563d-43ff-8cda-63365094a785';

-- PLAYER with active membership + president (QA cases 2–3): player@staging.local — unchanged by smoke seed

-- Optional: dedicated PLAYER no-membership account
insert into public.profiles (id, email, role, venue_id, display_name, status)
select
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'player-noclub@staging.local',
  'PLAYER',
  'venue-staging-a',
  'Player No Club QA',
  'active'
where not exists (
  select 1 from public.profiles where email = 'player-noclub@staging.local'
);

-- Pending request for president review QA (club@staging or applicant)
insert into public.club_membership_requests_v42 (id, tenant_id, club_id, user_id, message, status, version)
select
  gen_random_uuid(),
  'venue-staging-a',
  'club-smoke-42i1',
  '48a85745-900b-4703-80f7-d1dd8a82b081',
  'Phase 42J.1 QA pending',
  'pending',
  1
where not exists (
  select 1 from public.club_membership_requests_v42
  where club_id = 'club-smoke-42i1'
    and user_id = '48a85745-900b-4703-80f7-d1dd8a82b081'
    and status = 'pending'
);
