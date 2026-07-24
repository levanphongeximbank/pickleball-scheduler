-- =============================================================================
-- COMMS-05 — Rollback / recovery notes (NOT a safe data-preserving rollback)
-- =============================================================================
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED (paired with supabase-communication-comms05.sql)
--
-- WARNING:
--   Once Staging/Production data exists in communication_* tables, DROP is
--   destructive and NOT a safe rollback. Prefer forward-fix migrations.
--   This script is for pre-data / authored-package recovery only.
--
-- Does NOT:
--   - drop unrelated tables
--   - touch Identity / Club / Notification / Competition schemas
--   - reverse realtime publication (none was enabled in COMMS-05)
-- =============================================================================

drop trigger if exists communication_messages_reply_same_conversation_trg
  on public.communication_messages;
drop trigger if exists communication_pinned_same_conversation_trg
  on public.communication_pinned_messages;

drop function if exists public.communication_assert_reply_same_conversation();
drop function if exists public.communication_assert_pin_same_conversation();
drop function if exists public.communication_allocate_message_position(text);
drop function if exists public.communication_advance_read_cursor(text, text, timestamptz, text, bigint);

drop table if exists public.communication_persistence_events cascade;
drop table if exists public.communication_idempotency cascade;
drop table if exists public.communication_community_restrictions cascade;
drop table if exists public.communication_moderation_actions cascade;
drop table if exists public.communication_message_reports cascade;
drop table if exists public.communication_user_blocks cascade;
drop table if exists public.communication_pinned_messages cascade;
drop table if exists public.communication_direct_requests cascade;
drop table if exists public.communication_read_cursors cascade;
drop table if exists public.communication_message_reactions cascade;
drop table if exists public.communication_messages cascade;
drop table if exists public.communication_message_position_counters cascade;
drop table if exists public.communication_conversation_participants cascade;
drop table if exists public.communication_conversations cascade;

-- =============================================================================
-- END COMMS-05 rollback notes
-- Recovery after data exists: restore from backup; do not rely on this DROP script.
-- =============================================================================
