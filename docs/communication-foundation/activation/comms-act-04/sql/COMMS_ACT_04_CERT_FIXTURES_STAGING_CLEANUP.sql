-- =============================================================================
-- COMMS-ACT-04 — Cleanup temporary Club certification fixtures (STAGING ONLY)
-- =============================================================================
-- Owner GO: OWNER GO COMMS-ACT-04 STAGING TEMPORARY CLUB CERTIFICATION FIXTURES ONLY
-- Target: qyewbxjsiiyufanzcjcq
-- Production: expuvcohlcjzvrrauvud — BLOCKED
--
-- Deletes ONLY rows with marker prefix COMMS_ACT_04_CERT_FIXTURE_
-- Does NOT touch club_members / clubs / auth / non-marker Communication rows
-- Does NOT apply / rollback ACT-03 RLS
-- =============================================================================

do $$
declare
  v_marker text := 'COMMS_ACT_04_CERT_FIXTURE_';
  v_conv int;
begin
  select count(*)::int into v_conv
  from public.communication_conversations
  where conversation_id like v_marker || '%';

  raise notice 'COMMS-ACT-04 cleanup starting: % marker conversation(s)', v_conv;

  -- Child tables first (safe even without CASCADE assumptions)
  delete from public.communication_message_reactions
  where reaction_id like v_marker || '%'
     or conversation_id like v_marker || '%'
     or message_id like v_marker || '%';

  delete from public.communication_pinned_messages
  where conversation_id like v_marker || '%'
     or message_id like v_marker || '%';

  delete from public.communication_read_cursors
  where conversation_id like v_marker || '%';

  delete from public.communication_messages
  where message_id like v_marker || '%'
     or conversation_id like v_marker || '%';

  delete from public.communication_message_position_counters
  where conversation_id like v_marker || '%';

  delete from public.communication_conversation_participants
  where conversation_id like v_marker || '%';

  delete from public.communication_conversations
  where conversation_id like v_marker || '%';
end
$$;

-- Verify zero marker rows remain
select 'conversations' as table_name, count(*)::int as remaining_marker_rows
from public.communication_conversations
where conversation_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
union all
select 'participants', count(*)::int
from public.communication_conversation_participants
where conversation_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
union all
select 'messages', count(*)::int
from public.communication_messages
where conversation_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
   or message_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
union all
select 'reactions', count(*)::int
from public.communication_message_reactions
where reaction_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
   or conversation_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
union all
select 'pins', count(*)::int
from public.communication_pinned_messages
where conversation_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
union all
select 'cursors', count(*)::int
from public.communication_read_cursors
where conversation_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
union all
select 'counters', count(*)::int
from public.communication_message_position_counters
where conversation_id like 'COMMS_ACT_04_CERT_FIXTURE_%'
order by 1;
