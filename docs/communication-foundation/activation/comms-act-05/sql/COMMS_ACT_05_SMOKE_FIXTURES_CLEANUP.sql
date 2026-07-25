-- COMMS-ACT-05 smoke fixture cleanup (Staging only).
-- Run ONLY against qyewbxjsiiyufanzcjcq after Owner GO smoke.
-- NEVER run against expuvcohlcjzvrrauvud.

-- Verify target:
--   select current_setting('request.jwt.claim.role', true);

delete from public.communication_idempotency
where idempotency_key like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
   or request_fingerprint like 'COMMS_ACT_05_SMOKE_FIXTURE_%';

delete from public.communication_message_reports
where reason like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
   or details like 'COMMS_ACT_05_SMOKE_FIXTURE_%';

delete from public.communication_pinned_messages
where conversation_id in (
  select conversation_id from public.communication_conversations
  where context_ref like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
     or conversation_id like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
);

delete from public.communication_read_cursors
where conversation_id in (
  select conversation_id from public.communication_conversations
  where context_ref like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
     or conversation_id like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
);

delete from public.communication_messages
where body like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
   or client_idempotency_key like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
   or conversation_id in (
     select conversation_id from public.communication_conversations
     where context_ref like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
        or conversation_id like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
   );

delete from public.communication_conversation_participants
where conversation_id in (
  select conversation_id from public.communication_conversations
  where context_ref like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
     or conversation_id like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
);

delete from public.communication_conversations
where context_ref like 'COMMS_ACT_05_SMOKE_FIXTURE_%'
   or conversation_id like 'COMMS_ACT_05_SMOKE_FIXTURE_%';

-- Expect 0:
-- select count(*) from public.communication_messages where body like 'COMMS_ACT_05_SMOKE_FIXTURE_%';
-- select count(*) from public.communication_conversations where context_ref like 'COMMS_ACT_05_SMOKE_FIXTURE_%';
