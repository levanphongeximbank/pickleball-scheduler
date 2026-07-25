-- =============================================================================
-- COMMS-ACT-04 — Temporary Club certification fixtures (STAGING ONLY)
-- =============================================================================
-- Owner GO: OWNER GO COMMS-ACT-04 STAGING TEMPORARY CLUB CERTIFICATION FIXTURES ONLY
-- Target: qyewbxjsiiyufanzcjcq
-- Production: expuvcohlcjzvrrauvud — BLOCKED (do not run)
--
-- Scope:
--   - Communication tables ONLY
--   - Uses existing clubs / active / removed members (no auth user create)
--   - Does NOT mutate club_members / clubs / tenants / ownership
--   - Does NOT apply ACT-03 Client RLS
--   - Does NOT enable realtime / write grants / RPCs
--
-- Marker prefix: COMMS_ACT_04_CERT_FIXTURE_
-- Behavior: FAIL CLEARLY if any marker row already exists (not silent upsert)
-- Cleanup: COMMS_ACT_04_CERT_FIXTURES_STAGING_CLEANUP.sql
-- =============================================================================

do $$
declare
  v_marker text := 'COMMS_ACT_04_CERT_FIXTURE_';
  v_club_a text := 'club-smoke-42i1';
  v_club_b text := 'club-test-tt32-qa';
  v_tenant_a text := 'venue-staging-a';
  v_active_a uuid;
  v_active_b uuid;
  v_removed_a uuid;
  v_now timestamptz := timestamptz '2026-07-25T03:00:00Z';
  v_existing int;
begin
  -- Hard stop: refuse if Production ref appears in search_path / gucs (belt)
  if current_setting('request.headers', true) ilike '%expuvcohlcjzvrrauvud%' then
    raise exception 'COMMS-ACT-04 fixture blocked: Production target detected'
      using errcode = 'P0001';
  end if;

  select count(*)::int into v_existing
  from public.communication_conversations c
  where c.conversation_id like v_marker || '%';

  if v_existing > 0 then
    raise exception
      'COMMS-ACT-04 fixture blocked: % existing marker conversation(s) — run cleanup first or abort',
      v_existing
      using errcode = 'P0001';
  end if;

  -- Resolve existing Club A active member (do not create / mutate membership)
  select cm.user_id into v_active_a
  from public.club_members cm
  where cm.club_id = v_club_a
    and cm.status = 'active'
  order by cm.id
  limit 1;

  if v_active_a is null then
    raise exception
      'COMMS-ACT-04 fixture blocked: no active member for Club A (%)',
      v_club_a
      using errcode = 'P0001';
  end if;

  select cm.user_id into v_removed_a
  from public.club_members cm
  where cm.club_id = v_club_a
    and cm.status = 'removed'
  order by cm.id
  limit 1;

  if v_removed_a is null then
    raise exception
      'COMMS-ACT-04 fixture blocked: no removed member for Club A (%) — needed for inactive deny',
      v_club_a
      using errcode = 'P0001';
  end if;

  select cm.user_id into v_active_b
  from public.club_members cm
  where cm.club_id = v_club_b
    and cm.status = 'active'
    and cm.user_id <> v_active_a
  order by cm.id
  limit 1;

  if v_active_b is null then
    raise exception
      'COMMS-ACT-04 fixture blocked: no distinct active member for Club B (%)',
      v_club_b
      using errcode = 'P0001';
  end if;

  -- Verify clubs exist with expected tenant (read-only check)
  if not exists (
    select 1 from public.clubs c
    where c.id = v_club_a and c.tenant_id = v_tenant_a
  ) then
    raise exception
      'COMMS-ACT-04 fixture blocked: Club A missing or wrong tenant (%)',
      v_club_a
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.clubs c
    where c.id = v_club_b and c.tenant_id = v_tenant_a
  ) then
    raise exception
      'COMMS-ACT-04 fixture blocked: Club B missing or wrong tenant (%)',
      v_club_b
      using errcode = 'P0001';
  end if;

  -- ── Club A conversation + dependents ───────────────────────────────────────
  insert into public.communication_conversations (
    conversation_id, conversation_type, status, tenant_id, club_id,
    created_at, created_by_participant_id,
    channel_key, channel_kind, channel_name, channel_visibility, lifecycle_status,
    direct_pair_key, updated_at
  ) values (
    v_marker || 'CLUB_A',
    'CLUB', 'ACTIVE', v_tenant_a, v_club_a,
    v_now, v_active_a::text,
    v_marker || 'CLUB_A_GENERAL', 'GENERAL',
    'ACT-04 Cert Club A GENERAL', 'JOIN_REQUIRED', 'ACTIVE',
    null, v_now
  );

  insert into public.communication_conversation_participants (
    conversation_id, participant_id, role, status, joined_at, updated_at
  ) values (
    v_marker || 'CLUB_A', v_active_a::text, 'MEMBER', 'ACTIVE', v_now, v_now
  );

  insert into public.communication_message_position_counters (
    conversation_id, next_position
  ) values (v_marker || 'CLUB_A', 2);

  insert into public.communication_messages (
    message_id, conversation_id, sender_participant_id, body, status,
    created_at, position, client_idempotency_key
  ) values (
    v_marker || 'CLUB_A_MSG1',
    v_marker || 'CLUB_A',
    v_active_a::text,
    'COMMS_ACT_04_CERT_FIXTURE_ Club A message',
    'VISIBLE',
    v_now,
    1,
    v_marker || 'CLUB_A_IDEM1'
  );

  insert into public.communication_message_reactions (
    reaction_id, message_id, conversation_id, participant_id, emoji, created_at
  ) values (
    v_marker || 'CLUB_A_RX1',
    v_marker || 'CLUB_A_MSG1',
    v_marker || 'CLUB_A',
    v_active_a::text,
    '👍',
    v_now
  );

  insert into public.communication_pinned_messages (
    conversation_id, message_id, pinned_by_participant_id, pinned_at
  ) values (
    v_marker || 'CLUB_A',
    v_marker || 'CLUB_A_MSG1',
    v_active_a::text,
    v_now
  );

  insert into public.communication_read_cursors (
    conversation_id, participant_id, last_read_at,
    last_read_message_id, last_read_position, updated_at
  ) values (
    v_marker || 'CLUB_A',
    v_active_a::text,
    v_now,
    v_marker || 'CLUB_A_MSG1',
    1,
    v_now
  );

  -- ── Club B conversation + dependents ───────────────────────────────────────
  insert into public.communication_conversations (
    conversation_id, conversation_type, status, tenant_id, club_id,
    created_at, created_by_participant_id,
    channel_key, channel_kind, channel_name, channel_visibility, lifecycle_status,
    direct_pair_key, updated_at
  ) values (
    v_marker || 'CLUB_B',
    'CLUB', 'ACTIVE', v_tenant_a, v_club_b,
    v_now, v_active_b::text,
    v_marker || 'CLUB_B_GENERAL', 'GENERAL',
    'ACT-04 Cert Club B GENERAL', 'JOIN_REQUIRED', 'ACTIVE',
    null, v_now
  );

  insert into public.communication_conversation_participants (
    conversation_id, participant_id, role, status, joined_at, updated_at
  ) values (
    v_marker || 'CLUB_B', v_active_b::text, 'MEMBER', 'ACTIVE', v_now, v_now
  );

  insert into public.communication_message_position_counters (
    conversation_id, next_position
  ) values (v_marker || 'CLUB_B', 2);

  insert into public.communication_messages (
    message_id, conversation_id, sender_participant_id, body, status,
    created_at, position, client_idempotency_key
  ) values (
    v_marker || 'CLUB_B_MSG1',
    v_marker || 'CLUB_B',
    v_active_b::text,
    'COMMS_ACT_04_CERT_FIXTURE_ Club B message',
    'VISIBLE',
    v_now,
    1,
    v_marker || 'CLUB_B_IDEM1'
  );

  insert into public.communication_message_reactions (
    reaction_id, message_id, conversation_id, participant_id, emoji, created_at
  ) values (
    v_marker || 'CLUB_B_RX1',
    v_marker || 'CLUB_B_MSG1',
    v_marker || 'CLUB_B',
    v_active_b::text,
    '✅',
    v_now
  );

  insert into public.communication_pinned_messages (
    conversation_id, message_id, pinned_by_participant_id, pinned_at
  ) values (
    v_marker || 'CLUB_B',
    v_marker || 'CLUB_B_MSG1',
    v_active_b::text,
    v_now
  );

  insert into public.communication_read_cursors (
    conversation_id, participant_id, last_read_at,
    last_read_message_id, last_read_position, updated_at
  ) values (
    v_marker || 'CLUB_B',
    v_active_b::text,
    v_now,
    v_marker || 'CLUB_B_MSG1',
    1,
    v_now
  );

  -- ── Negative-scope conversations (Direct / System / Community) ─────────────
  insert into public.communication_conversations (
    conversation_id, conversation_type, status, tenant_id, club_id,
    created_at, created_by_participant_id,
    channel_key, channel_kind, channel_name, channel_visibility, lifecycle_status,
    direct_pair_key, updated_at
  ) values
  (
    v_marker || 'DIRECT',
    'DIRECT', 'ACTIVE', null, null,
    v_now, v_active_a::text,
    null, null, null, null, null,
    v_marker || 'DIRECT_PAIR',
    v_now
  ),
  (
    v_marker || 'SYSTEM',
    'SYSTEM', 'ACTIVE', v_tenant_a, null,
    v_now, v_active_a::text,
    null, null, null, null, null,
    null,
    v_now
  ),
  (
    v_marker || 'COMMUNITY',
    'COMMUNITY', 'ACTIVE', v_tenant_a, null,
    v_now, v_active_a::text,
    v_marker || 'COMMUNITY_LOBBY', 'LOBBY',
    'ACT-04 Cert Community LOBBY', 'PUBLIC', 'ACTIVE',
    null, v_now
  );

  raise notice 'COMMS-ACT-04 cert fixtures inserted. ClubA=%(%) ClubB=%(%) activeA=% activeB=% removedA=%',
    v_club_a, v_tenant_a, v_club_b, v_tenant_a, v_active_a, v_active_b, v_removed_a;
end
$$;

-- Post-insert inventory (marker only)
select 'conversations' as table_name, count(*)::int as marker_rows
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
