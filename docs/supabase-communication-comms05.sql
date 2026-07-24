-- =============================================================================
-- COMMS-05 — Communication Persistence & Realtime Foundation
-- =============================================================================
-- Ownership: Communication Foundation (src/features/communication/)
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED
-- Status: AUTHORIZED FOR AUTHORING ONLY — DO NOT APPLY
-- Applied: false
-- Environments: NONE (no Staging / Production / remote apply by this phase)
--
-- Prerequisites (documentation only):
--   - COMMS-00 … COMMS-04 merged on origin/main
--   - public.profiles / public.user_venue_id() (docs/supabase-rbac.sql) present for future
--     client RLS activation — NOT used to open policies in this package
--   - Club membership SoT remains Club Management (club_members / phase42 helpers)
--   - Community membership SoT remains external (no Communication-owned membership table)
--   - Backup / restore plan required before any future Staging apply
--
-- Activation gates (explicit):
--   CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED
--     Deny-all client policies only. Trusted writers use service-role / backend path
--     after application-layer authorization (ports: ClubMembershipReader,
--     CommunityMembershipReader, IdentityActorPort, TenantScopePort).
--   REALTIME_PUBLICATION = DEFERRED_NOT_ENABLED
--     Do NOT add tables to supabase_realtime in this package.
--   SQL_APPLY = DEFERRED_STAGING_FIRST_GATE
--   NOTIFICATION_OUTBOX = DEFERRED_INTEGRATION_GATE
--   ATTACHMENT_STORAGE_BUCKET_RLS = DEFERRED (refs only; no binary / bucket invent)
--
-- Does NOT:
--   - apply to Staging / Production / remote Supabase
--   - enable realtime publication
--   - invent Identity / Club membership / Player profile / tenant SoT
--   - store notification delivery state
--   - use USING (true) / WITH CHECK (true)
--   - drop or rewrite unrelated tables
-- =============================================================================

-- ─── 1. Conversations ───────────────────────────────────────────────────────
create table if not exists public.communication_conversations (
  conversation_id text primary key,
  conversation_type text not null,
  status text not null default 'ACTIVE',
  tenant_id text,
  club_id text,
  context_ref text,
  created_at timestamptz not null,
  created_by_participant_id text,
  -- Channel metadata (CLUB / COMMUNITY only; null for DIRECT)
  channel_key text,
  channel_kind text,
  channel_name text,
  channel_visibility text,
  lifecycle_status text,
  slow_mode_interval_seconds integer not null default 0,
  -- DIRECT pair uniqueness (null for non-DIRECT)
  direct_pair_key text,
  updated_at timestamptz not null default now(),
  constraint communication_conversations_type_chk check (
    conversation_type in ('DIRECT', 'CLUB', 'COMMUNITY', 'SYSTEM')
  ),
  constraint communication_conversations_status_chk check (
    status in ('ACTIVE', 'ARCHIVED', 'CLOSED')
  ),
  constraint communication_conversations_club_req_chk check (
    conversation_type <> 'CLUB' or club_id is not null
  ),
  constraint communication_conversations_community_req_chk check (
    conversation_type <> 'COMMUNITY' or tenant_id is not null
  ),
  constraint communication_conversations_direct_pair_chk check (
    (conversation_type = 'DIRECT' and direct_pair_key is not null)
    or (conversation_type <> 'DIRECT' and direct_pair_key is null)
  ),
  constraint communication_conversations_channel_key_chk check (
    (conversation_type in ('CLUB', 'COMMUNITY') and channel_key is not null)
    or (conversation_type not in ('CLUB', 'COMMUNITY') and channel_key is null)
  ),
  constraint communication_conversations_slow_mode_chk check (
    slow_mode_interval_seconds >= 0
  ),
  constraint communication_conversations_visibility_chk check (
    channel_visibility is null
    or channel_visibility in ('PUBLIC', 'JOIN_REQUIRED', 'RESTRICTED', 'READ_ONLY')
  ),
  constraint communication_conversations_lifecycle_chk check (
    lifecycle_status is null
    or lifecycle_status in ('ACTIVE', 'ARCHIVED', 'SUSPENDED')
  )
);

comment on table public.communication_conversations is
  'COMMS-05 Communication-owned conversation / channel aggregate. Not Club/Identity SoT.';

create unique index if not exists communication_conversations_direct_pair_uidx
  on public.communication_conversations (direct_pair_key)
  where direct_pair_key is not null;

create unique index if not exists communication_conversations_channel_key_uidx
  on public.communication_conversations (channel_key)
  where channel_key is not null;

-- Default Community LOBBY uniqueness per tenant
create unique index if not exists communication_conversations_community_lobby_uidx
  on public.communication_conversations (tenant_id)
  where conversation_type = 'COMMUNITY'
    and channel_kind = 'LOBBY'
    and tenant_id is not null;

-- Default Club GENERAL uniqueness per club (one GENERAL default channel)
create unique index if not exists communication_conversations_club_general_uidx
  on public.communication_conversations (club_id)
  where conversation_type = 'CLUB'
    and channel_kind = 'GENERAL'
    and club_id is not null;

create index if not exists communication_conversations_club_idx
  on public.communication_conversations (club_id)
  where club_id is not null;

create index if not exists communication_conversations_tenant_idx
  on public.communication_conversations (tenant_id)
  where tenant_id is not null;

create index if not exists communication_conversations_type_status_idx
  on public.communication_conversations (conversation_type, status);

-- ─── 2. Participants ────────────────────────────────────────────────────────
create table if not exists public.communication_conversation_participants (
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  participant_id text not null,
  role text not null default 'MEMBER',
  status text not null default 'ACTIVE',
  joined_at timestamptz not null,
  player_id text,
  muted_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, participant_id),
  constraint communication_participants_role_chk check (
    role in ('MEMBER', 'MODERATOR', 'OWNER')
  ),
  constraint communication_participants_status_chk check (
    status in ('ACTIVE', 'MUTED', 'SUSPENDED', 'REMOVED')
  )
);

comment on table public.communication_conversation_participants is
  'COMMS-05 conversation membership rows. Not Club membership / Identity SoT.';

-- At most one ACTIVE membership row per (conversation, participant) — PK already unique.
-- Inbox listing by participant
create index if not exists communication_participants_participant_idx
  on public.communication_conversation_participants (participant_id, status);

create index if not exists communication_participants_active_conv_idx
  on public.communication_conversation_participants (conversation_id)
  where status = 'ACTIVE';

-- ─── 3. Message position sequences (per conversation) ───────────────────────
create table if not exists public.communication_message_position_counters (
  conversation_id text primary key
    references public.communication_conversations (conversation_id) on delete cascade,
  next_position bigint not null default 1,
  constraint communication_message_position_counters_next_chk check (next_position >= 1)
);

comment on table public.communication_message_position_counters is
  'COMMS-05 immutable ordering authority for messages (server-side position allocation).';

-- ─── 4. Messages ────────────────────────────────────────────────────────────
create table if not exists public.communication_messages (
  message_id text primary key,
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  sender_participant_id text not null,
  body text not null,
  status text not null default 'VISIBLE',
  created_at timestamptz not null,
  updated_at timestamptz,
  reply_to_message_id text,
  attachment_refs jsonb not null default '[]'::jsonb,
  -- Immutable ordering within conversation (server authority; not client clock)
  position bigint not null,
  -- Optional client retry key (idempotent send)
  client_idempotency_key text,
  constraint communication_messages_status_chk check (
    status in ('VISIBLE', 'EDITED', 'DELETED')
  ),
  constraint communication_messages_body_chk check (char_length(body) > 0),
  constraint communication_messages_position_chk check (position >= 1),
  constraint communication_messages_attachment_refs_chk check (
    jsonb_typeof(attachment_refs) = 'array'
  ),
  constraint communication_messages_reply_fk foreign key (reply_to_message_id)
    references public.communication_messages (message_id)
);

comment on table public.communication_messages is
  'COMMS-05 message rows. Attachment refs only (no binary). Ordering via position.';

create unique index if not exists communication_messages_conv_position_uidx
  on public.communication_messages (conversation_id, position);

create unique index if not exists communication_messages_conv_idempotency_uidx
  on public.communication_messages (conversation_id, client_idempotency_key)
  where client_idempotency_key is not null;

create index if not exists communication_messages_conv_created_idx
  on public.communication_messages (conversation_id, position desc);

create index if not exists communication_messages_sender_latest_idx
  on public.communication_messages (conversation_id, sender_participant_id, position desc);

create index if not exists communication_messages_reply_idx
  on public.communication_messages (reply_to_message_id)
  where reply_to_message_id is not null;

-- Reply must belong to same conversation (trigger; CHECK cannot self-ref easily)
create or replace function public.communication_assert_reply_same_conversation()
returns trigger
language plpgsql
as $$
declare
  target_conversation_id text;
begin
  if new.reply_to_message_id is null then
    return new;
  end if;
  select m.conversation_id into target_conversation_id
  from public.communication_messages m
  where m.message_id = new.reply_to_message_id;
  if target_conversation_id is null then
    raise exception 'COMMS reply target not found: %', new.reply_to_message_id
      using errcode = '23503';
  end if;
  if target_conversation_id <> new.conversation_id then
    raise exception 'COMMS cross-conversation reply denied'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists communication_messages_reply_same_conversation_trg
  on public.communication_messages;
create trigger communication_messages_reply_same_conversation_trg
  before insert or update of reply_to_message_id, conversation_id
  on public.communication_messages
  for each row
  execute function public.communication_assert_reply_same_conversation();

-- Allocate next position + insert helper (trusted backend / service-role)
create or replace function public.communication_allocate_message_position(p_conversation_id text)
returns bigint
language plpgsql
as $$
declare
  v_position bigint;
begin
  insert into public.communication_message_position_counters (conversation_id, next_position)
  values (p_conversation_id, 2)
  on conflict (conversation_id) do update
    set next_position = public.communication_message_position_counters.next_position + 1
  returning next_position - 1 into v_position;
  return v_position;
end;
$$;

comment on function public.communication_allocate_message_position(text) is
  'COMMS-05 server-side message position allocator. Client execute revoked; service-role only.';

-- ─── 5. Reactions ───────────────────────────────────────────────────────────
create table if not exists public.communication_message_reactions (
  reaction_id text primary key,
  message_id text not null
    references public.communication_messages (message_id) on delete cascade,
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  participant_id text not null,
  emoji text not null,
  created_at timestamptz not null,
  constraint communication_reactions_emoji_chk check (
    char_length(emoji) > 0 and char_length(emoji) <= 32
  )
);

comment on table public.communication_message_reactions is
  'COMMS-05 message reactions. Unique (message, participant, emoji).';

create unique index if not exists communication_reactions_unique_uidx
  on public.communication_message_reactions (message_id, participant_id, emoji);

create index if not exists communication_reactions_message_idx
  on public.communication_message_reactions (message_id);

-- ─── 6. Read cursors ────────────────────────────────────────────────────────
create table if not exists public.communication_read_cursors (
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  participant_id text not null,
  last_read_at timestamptz not null,
  last_read_message_id text
    references public.communication_messages (message_id) on delete set null,
  last_read_position bigint,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, participant_id),
  constraint communication_read_cursors_position_chk check (
    last_read_position is null or last_read_position >= 1
  )
);

comment on table public.communication_read_cursors is
  'COMMS-05 per-participant read cursor. Monotonic advance enforced by RPC.';

create index if not exists communication_read_cursors_participant_idx
  on public.communication_read_cursors (participant_id);

-- Monotonic upsert (trusted backend)
create or replace function public.communication_advance_read_cursor(
  p_conversation_id text,
  p_participant_id text,
  p_last_read_at timestamptz,
  p_last_read_message_id text default null,
  p_last_read_position bigint default null
)
returns public.communication_read_cursors
language plpgsql
as $$
declare
  v_row public.communication_read_cursors;
begin
  insert into public.communication_read_cursors as c (
    conversation_id,
    participant_id,
    last_read_at,
    last_read_message_id,
    last_read_position,
    updated_at
  ) values (
    p_conversation_id,
    p_participant_id,
    p_last_read_at,
    p_last_read_message_id,
    p_last_read_position,
    now()
  )
  on conflict (conversation_id, participant_id) do update
    set
      last_read_at = excluded.last_read_at,
      last_read_message_id = coalesce(excluded.last_read_message_id, c.last_read_message_id),
      last_read_position = case
        when excluded.last_read_position is null then c.last_read_position
        when c.last_read_position is null then excluded.last_read_position
        when excluded.last_read_position >= c.last_read_position then excluded.last_read_position
        else c.last_read_position
      end,
      updated_at = now()
    where excluded.last_read_at >= c.last_read_at
  returning * into v_row;

  if v_row.conversation_id is null then
    -- Conflict path returned no row ⇒ regression attempt; re-select current
    select * into v_row
    from public.communication_read_cursors
    where conversation_id = p_conversation_id
      and participant_id = p_participant_id;
    if v_row.conversation_id is not null and p_last_read_at < v_row.last_read_at then
      raise exception 'COMMS read cursor regression'
        using errcode = 'P0001';
    end if;
  end if;

  return v_row;
end;
$$;

comment on function public.communication_advance_read_cursor(text, text, timestamptz, text, bigint) is
  'COMMS-05 monotonic read-cursor advance. Client execute revoked; service-role / backend only.';

-- ─── 7. Direct conversation requests ────────────────────────────────────────
create table if not exists public.communication_direct_requests (
  request_id text primary key,
  pair_key text not null,
  requester_participant_id text not null,
  recipient_participant_id text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null,
  updated_at timestamptz,
  message text,
  constraint communication_direct_requests_status_chk check (
    status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')
  ),
  constraint communication_direct_requests_parties_chk check (
    requester_participant_id <> recipient_participant_id
  )
);

comment on table public.communication_direct_requests is
  'COMMS-05 direct conversation requests. At most one PENDING per pair_key.';

create unique index if not exists communication_direct_requests_pending_pair_uidx
  on public.communication_direct_requests (pair_key)
  where status = 'PENDING';

create index if not exists communication_direct_requests_recipient_idx
  on public.communication_direct_requests (recipient_participant_id, status);

create index if not exists communication_direct_requests_pair_idx
  on public.communication_direct_requests (pair_key);

-- ─── 8. Pinned messages ─────────────────────────────────────────────────────
create table if not exists public.communication_pinned_messages (
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  message_id text not null
    references public.communication_messages (message_id) on delete cascade,
  pinned_by_participant_id text not null,
  pinned_at timestamptz not null,
  primary key (conversation_id, message_id)
);

comment on table public.communication_pinned_messages is
  'COMMS-05 pinned messages for Club/Community channels. Unique per (conversation, message).';

create index if not exists communication_pinned_messages_conv_idx
  on public.communication_pinned_messages (conversation_id, pinned_at desc);

-- Pin target must belong to same conversation
create or replace function public.communication_assert_pin_same_conversation()
returns trigger
language plpgsql
as $$
declare
  target_conversation_id text;
begin
  select m.conversation_id into target_conversation_id
  from public.communication_messages m
  where m.message_id = new.message_id;
  if target_conversation_id is null then
    raise exception 'COMMS pin target message not found'
      using errcode = '23503';
  end if;
  if target_conversation_id <> new.conversation_id then
    raise exception 'COMMS pin cross-conversation denied'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists communication_pinned_same_conversation_trg
  on public.communication_pinned_messages;
create trigger communication_pinned_same_conversation_trg
  before insert or update of conversation_id, message_id
  on public.communication_pinned_messages
  for each row
  execute function public.communication_assert_pin_same_conversation();

-- ─── 9. User blocks ─────────────────────────────────────────────────────────
create table if not exists public.communication_user_blocks (
  block_id text primary key,
  blocker_participant_id text not null,
  blocked_participant_id text not null,
  created_at timestamptz not null,
  reason text,
  constraint communication_user_blocks_self_chk check (
    blocker_participant_id <> blocked_participant_id
  )
);

comment on table public.communication_user_blocks is
  'COMMS-05 user block edges for Direct Messaging access denial. Not Identity ban SoT.';

create unique index if not exists communication_user_blocks_edge_uidx
  on public.communication_user_blocks (blocker_participant_id, blocked_participant_id);

create index if not exists communication_user_blocks_blocked_idx
  on public.communication_user_blocks (blocked_participant_id);

-- ─── 10. Message reports ────────────────────────────────────────────────────
create table if not exists public.communication_message_reports (
  report_id text primary key,
  message_id text not null
    references public.communication_messages (message_id) on delete cascade,
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  reporter_participant_id text not null,
  reason text not null,
  created_at timestamptz not null,
  details text,
  constraint communication_message_reports_reason_chk check (char_length(reason) > 0)
);

comment on table public.communication_message_reports is
  'COMMS-05 message reports. Moderation evidence only; not Notification delivery.';

create index if not exists communication_message_reports_conv_idx
  on public.communication_message_reports (conversation_id, created_at desc);

create index if not exists communication_message_reports_message_idx
  on public.communication_message_reports (message_id);

-- ─── 11. Moderation actions ─────────────────────────────────────────────────
create table if not exists public.communication_moderation_actions (
  action_id text primary key,
  action_type text not null,
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  actor_participant_id text not null,
  target_participant_id text,
  target_message_id text
    references public.communication_messages (message_id) on delete set null,
  created_at timestamptz not null,
  reason text,
  constraint communication_moderation_actions_type_chk check (
    action_type in (
      'MUTE_PARTICIPANT',
      'REMOVE_PARTICIPANT',
      'RESTRICT_PARTICIPANT',
      'REMOVE_MESSAGE',
      'HIDE_MESSAGE',
      'BAN_PARTICIPANT',
      'RESTORE_PARTICIPANT'
    )
  ),
  constraint communication_moderation_actions_target_chk check (
    (
      action_type in (
        'MUTE_PARTICIPANT',
        'REMOVE_PARTICIPANT',
        'RESTRICT_PARTICIPANT',
        'BAN_PARTICIPANT',
        'RESTORE_PARTICIPANT'
      )
      and target_participant_id is not null
    )
    or (
      action_type in ('REMOVE_MESSAGE', 'HIDE_MESSAGE')
      and target_message_id is not null
    )
  )
);

comment on table public.communication_moderation_actions is
  'COMMS-05 moderation action log. Communication-local; not Identity audit_logs.';

create index if not exists communication_moderation_actions_conv_idx
  on public.communication_moderation_actions (conversation_id, created_at desc);

-- ─── 12. Community restrictions / bans ──────────────────────────────────────
create table if not exists public.communication_community_restrictions (
  tenant_id text not null,
  participant_id text not null,
  status text not null default 'NONE',
  scope text not null default 'COMMUNITY',
  channel_key text,
  reason_code text,
  reason text,
  updated_at timestamptz not null,
  constraint communication_community_restrictions_status_chk check (
    status in ('NONE', 'SUSPENDED', 'BANNED')
  ),
  constraint communication_community_restrictions_scope_chk check (
    scope in ('COMMUNITY', 'CHANNEL')
  ),
  constraint communication_community_restrictions_channel_chk check (
    (scope = 'CHANNEL' and channel_key is not null)
    or (scope = 'COMMUNITY' and channel_key is null)
  )
);

comment on table public.communication_community_restrictions is
  'COMMS-05 community restriction / ban evidence. Not Identity account status SoT.';

-- Unique community-scope row per (tenant, participant)
create unique index if not exists communication_community_restrictions_community_uidx
  on public.communication_community_restrictions (tenant_id, participant_id)
  where scope = 'COMMUNITY';

-- Unique channel-scope row per (tenant, participant, channel)
create unique index if not exists communication_community_restrictions_channel_uidx
  on public.communication_community_restrictions (tenant_id, participant_id, channel_key)
  where scope = 'CHANNEL' and channel_key is not null;

create index if not exists communication_community_restrictions_tenant_idx
  on public.communication_community_restrictions (tenant_id, status);

-- ─── 13. Idempotency ledger (optional send / command replay) ────────────────
create table if not exists public.communication_idempotency (
  idempotency_key text not null,
  operation_type text not null,
  conversation_id text,
  tenant_id text,
  club_id text,
  result_entity_type text,
  result_entity_id text,
  request_fingerprint text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (operation_type, idempotency_key)
);

comment on table public.communication_idempotency is
  'COMMS-05 command/send idempotency ledger. Not Finance/Club idempotency tables.';

create index if not exists communication_idempotency_conversation_idx
  on public.communication_idempotency (conversation_id)
  where conversation_id is not null;

-- ─── 14. Persistence event intent (minimal outbox boundary; not Notification) ─
create table if not exists public.communication_persistence_events (
  event_id text primary key,
  conversation_id text not null
    references public.communication_conversations (conversation_id) on delete cascade,
  event_type text not null,
  event_version integer not null default 1,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  catch_up_cursor text,
  payload jsonb not null default '{}'::jsonb,
  delivery_intent text not null default 'REALTIME_SIGNAL',
  constraint communication_persistence_events_type_chk check (
    event_type in (
      'MESSAGE_CREATED',
      'MESSAGE_UPDATED',
      'MESSAGE_HIDDEN',
      'PARTICIPANT_CHANGED',
      'ACCESS_CHANGED',
      'READ_STATE_CHANGED',
      'PIN_CHANGED',
      'MODERATION_CHANGED'
    )
  ),
  constraint communication_persistence_events_delivery_chk check (
    delivery_intent in ('REALTIME_SIGNAL', 'DEFERRED_NOTIFICATION', 'DEFERRED_AUDIT')
  ),
  constraint communication_persistence_events_version_chk check (event_version >= 1)
);

comment on table public.communication_persistence_events is
  'COMMS-05 persistence event intent / outbox boundary. Persistence is SoT; realtime is signal only. Notification delivery deferred.';

create index if not exists communication_persistence_events_conv_idx
  on public.communication_persistence_events (conversation_id, recorded_at asc);

create index if not exists communication_persistence_events_catchup_idx
  on public.communication_persistence_events (conversation_id, event_id);

-- ─── 15. RLS — fail closed (service-role trusted writers only) ───────────────
-- CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED
-- Reasons:
--   - Club membership SoT is Club-owned (phase42_active_club_member_id) — embedding
--     requires Owner approval before client policies.
--   - Community membership has no verified SQL helper yet.
--   - Direct participant policies are designed but deferred until Staging RLS review.
-- Until activation: deny-all for anon/authenticated; service-role bypasses RLS.
-- NO USING (true) / WITH CHECK (true).

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

revoke all on function public.communication_allocate_message_position(text) from anon, authenticated;
revoke all on function public.communication_advance_read_cursor(text, text, timestamptz, text, bigint) from anon, authenticated;

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

-- ─── 16. Future client RLS stubs (NOT ENABLED — documentation only) ─────────
-- Planned DIRECT policy shape (after Owner GO + Staging review):
--   exists (
--     select 1 from public.communication_conversation_participants p
--     where p.conversation_id = conversation_id
--       and p.participant_id = auth.uid()::text
--       and p.status = 'ACTIVE'
--   )
-- Planned CLUB gate (Owner-approved reuse only):
--   public.phase42_active_club_member_id(club_id) is not null
-- Planned COMMUNITY tenant stamp:
--   tenant_id = public.user_venue_id()
-- Community membership helper: ACTIVATION_BLOCKER until Platform publishes SQL helper.
--
-- REALTIME_PUBLICATION = DEFERRED_NOT_ENABLED
-- Do not run: alter publication supabase_realtime add table …
-- When enabled later: publish only communication_messages (+ maybe participants)
--   NEVER publish communication_idempotency / communication_persistence_events /
--   communication_user_blocks as unscoped client feeds.

-- =============================================================================
-- END COMMS-05 migration
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED
-- CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED
-- REALTIME_PUBLICATION = DEFERRED_NOT_ENABLED
-- SQL_APPLY = DEFERRED_STAGING_FIRST_GATE
-- =============================================================================
