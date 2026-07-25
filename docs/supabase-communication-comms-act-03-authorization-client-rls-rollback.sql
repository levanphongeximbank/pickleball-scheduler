-- =============================================================================
-- COMMS-ACT-03 — Rollback Client RLS to deny-all (non-destructive to data)
-- =============================================================================
-- Ownership: Communication Foundation
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED
-- Status: AUTHORIZED FOR AUTHORING ONLY — DO NOT APPLY
--
-- Purpose: remove ACT-03 Club SELECT Client RLS surface and return Communication
-- tables to COMMS-05 deny-all posture WITHOUT dropping tables or deleting rows.
--
-- Does NOT:
--   - drop communication_* tables
--   - delete conversation/message data
--   - touch Identity / Club membership / Community Platform tables
--   - alter supabase_realtime publication
--   - target Production unless Owner separately authorizes
-- =============================================================================

-- Drop ACT-03 Club SELECT policies
drop policy if exists communication_conversations_club_select
  on public.communication_conversations;
drop policy if exists communication_participants_club_select
  on public.communication_conversation_participants;
drop policy if exists communication_messages_club_select
  on public.communication_messages;
drop policy if exists communication_reactions_club_select
  on public.communication_message_reactions;
drop policy if exists communication_pinned_messages_club_select
  on public.communication_pinned_messages;
drop policy if exists communication_read_cursors_club_own_select
  on public.communication_read_cursors;

-- Drop immutable triggers (helpers dropped below)
drop trigger if exists communication_auth_conversations_immutable_trg
  on public.communication_conversations;
drop trigger if exists communication_auth_messages_immutable_trg
  on public.communication_messages;
drop trigger if exists communication_auth_participants_immutable_trg
  on public.communication_conversation_participants;

-- Drop ACT-03 helpers
drop function if exists public.communication_auth_can_select_club_conversation(text);
drop function if exists public.communication_auth_is_active_club_member(text);
drop function if exists public.communication_auth_uid_text();
drop function if exists public.communication_auth_reject_conversation_ownership_mutation();
drop function if exists public.communication_auth_reject_message_identity_mutation();
drop function if exists public.communication_auth_reject_participant_identity_mutation();

-- Restore deny-all policies (idempotent)
drop policy if exists communication_conversations_deny_all on public.communication_conversations;
create policy communication_conversations_deny_all on public.communication_conversations
  for all using (false) with check (false);

drop policy if exists communication_participants_deny_all on public.communication_conversation_participants;
create policy communication_participants_deny_all on public.communication_conversation_participants
  for all using (false) with check (false);

drop policy if exists communication_position_counters_deny_all on public.communication_message_position_counters;
create policy communication_position_counters_deny_all on public.communication_message_position_counters
  for all using (false) with check (false);

drop policy if exists communication_messages_deny_all on public.communication_messages;
create policy communication_messages_deny_all on public.communication_messages
  for all using (false) with check (false);

drop policy if exists communication_reactions_deny_all on public.communication_message_reactions;
create policy communication_reactions_deny_all on public.communication_message_reactions
  for all using (false) with check (false);

drop policy if exists communication_read_cursors_deny_all on public.communication_read_cursors;
create policy communication_read_cursors_deny_all on public.communication_read_cursors
  for all using (false) with check (false);

drop policy if exists communication_direct_requests_deny_all on public.communication_direct_requests;
create policy communication_direct_requests_deny_all on public.communication_direct_requests
  for all using (false) with check (false);

drop policy if exists communication_pinned_messages_deny_all on public.communication_pinned_messages;
create policy communication_pinned_messages_deny_all on public.communication_pinned_messages
  for all using (false) with check (false);

drop policy if exists communication_user_blocks_deny_all on public.communication_user_blocks;
create policy communication_user_blocks_deny_all on public.communication_user_blocks
  for all using (false) with check (false);

drop policy if exists communication_message_reports_deny_all on public.communication_message_reports;
create policy communication_message_reports_deny_all on public.communication_message_reports
  for all using (false) with check (false);

drop policy if exists communication_moderation_actions_deny_all on public.communication_moderation_actions;
create policy communication_moderation_actions_deny_all on public.communication_moderation_actions
  for all using (false) with check (false);

drop policy if exists communication_community_restrictions_deny_all on public.communication_community_restrictions;
create policy communication_community_restrictions_deny_all on public.communication_community_restrictions
  for all using (false) with check (false);

drop policy if exists communication_idempotency_deny_all on public.communication_idempotency;
create policy communication_idempotency_deny_all on public.communication_idempotency
  for all using (false) with check (false);

drop policy if exists communication_persistence_events_deny_all on public.communication_persistence_events;
create policy communication_persistence_events_deny_all on public.communication_persistence_events
  for all using (false) with check (false);

-- Revoke all client table privileges (deny-all posture)
revoke all on public.communication_conversations from anon, authenticated;
revoke all on public.communication_conversation_participants from anon, authenticated;
revoke all on public.communication_message_position_counters from anon, authenticated;
revoke all on public.communication_messages from anon, authenticated;
revoke all on public.communication_message_reactions from anon, authenticated;
revoke all on public.communication_read_cursors from anon, authenticated;
revoke all on public.communication_direct_requests from anon, authenticated;
revoke all on public.communication_pinned_messages from anon, authenticated;
revoke all on public.communication_user_blocks from anon, authenticated;
revoke all on public.communication_message_reports from anon, authenticated;
revoke all on public.communication_moderation_actions from anon, authenticated;
revoke all on public.communication_community_restrictions from anon, authenticated;
revoke all on public.communication_idempotency from anon, authenticated;
revoke all on public.communication_persistence_events from anon, authenticated;

revoke all on function public.communication_allocate_message_position(text)
  from public, anon, authenticated;
revoke all on function public.communication_advance_read_cursor(text, text, timestamptz, text, bigint)
  from public, anon, authenticated;

-- Ensure RLS remains enabled
alter table public.communication_conversations enable row level security;
alter table public.communication_conversation_participants enable row level security;
alter table public.communication_message_position_counters enable row level security;
alter table public.communication_messages enable row level security;
alter table public.communication_message_reactions enable row level security;
alter table public.communication_read_cursors enable row level security;
alter table public.communication_direct_requests enable row level security;
alter table public.communication_pinned_messages enable row level security;
alter table public.communication_user_blocks enable row level security;
alter table public.communication_message_reports enable row level security;
alter table public.communication_moderation_actions enable row level security;
alter table public.communication_community_restrictions enable row level security;
alter table public.communication_idempotency enable row level security;
alter table public.communication_persistence_events enable row level security;

-- =============================================================================
-- END COMMS-ACT-03 rollback
-- RESULT = DENY_ALL_CLIENT_RLS_RESTORED
-- DATA_PRESERVED = true
-- REALTIME_UNCHANGED = true
-- =============================================================================
