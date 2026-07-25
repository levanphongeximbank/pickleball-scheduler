-- =============================================================================
-- COMMS-ACT-03 — Communication Authorization & Client RLS Foundation
-- =============================================================================
-- Ownership: Communication Foundation (src/features/communication/)
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED
-- Status: AUTHORIZED FOR AUTHORING ONLY — DO NOT APPLY
-- Applied: false
-- Environments: NONE (no Staging / Production / remote apply by this phase)
--
-- Prerequisites (must already exist from COMMS-05 Staging apply + Club Phase 42):
--   - 14 public.communication_* tables with RLS enabled
--   - COMMS-05 deny-all policies present
--   - public.phase42_active_club_member_id(text) (Club Management SoT)
--   - public.profiles / auth.uid()
--
-- Capability decisions (ACT-03):
--   DIRECT / SYSTEM     → TRUSTED_BACKEND_ONLY (keep deny-all; no client grants)
--   COMMUNITY           → BLOCKED_FAIL_CLOSED (no membership SQL helper)
--   CLUB SELECT         → CLIENT_RLS_READY (scoped policies authored here)
--   CLUB writes         → TRUSTED_BACKEND_ONLY (no INSERT/UPDATE/DELETE grants)
--   reports/moderation  → TRUSTED_BACKEND_ONLY
--   RPCs                → TRUSTED_BACKEND_ONLY (execute remains revoked)
--   realtime            → BLOCKED (do not alter supabase_realtime)
--
-- Authored SQL ≠ applied. Owner GO required before Staging apply.
-- Does NOT invent Club/Community membership tables.
-- Does NOT use USING (true) / WITH CHECK (true).
-- Does NOT open Production.
-- =============================================================================

-- ─── 0. Prerequisite: canonical Club membership helper ───────────────────────
do $$
begin
  if to_regprocedure('public.phase42_active_club_member_id(text)') is null then
    raise exception
      'COMMS-ACT-03 blocked: public.phase42_active_club_member_id(text) missing — keep deny-all'
      using errcode = 'P0001';
  end if;
end
$$;

-- ─── 1. Communication authorization helpers (SECURITY DEFINER, fixed path) ───
-- Helpers own Communication RLS predicates. They call Club SoT; they do not
-- invent membership. SECURITY DEFINER avoids RLS recursion when inspecting
-- communication_conversations from participant/message policies.

create or replace function public.communication_auth_uid_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()::text;
$$;

comment on function public.communication_auth_uid_text() is
  'COMMS-ACT-03: auth.uid() as text; fail-closed when null.';

create or replace function public.communication_auth_is_active_club_member(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and p_club_id is not null
    and length(trim(p_club_id)) > 0
    and public.phase42_active_club_member_id(p_club_id) is not null;
$$;

comment on function public.communication_auth_is_active_club_member(text) is
  'COMMS-ACT-03: Club SELECT gate via canonical phase42_active_club_member_id.';

create or replace function public.communication_auth_can_select_club_conversation(
  p_conversation_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communication_conversations c
    where c.conversation_id = p_conversation_id
      and c.conversation_type = 'CLUB'
      and c.club_id is not null
      and public.communication_auth_is_active_club_member(c.club_id)
  );
$$;

comment on function public.communication_auth_can_select_club_conversation(text) is
  'COMMS-ACT-03: conversation-scoped Club SELECT predicate (SECURITY DEFINER).';

-- Immutable ownership / identity columns (fail closed on mutation)
create or replace function public.communication_auth_reject_conversation_ownership_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.conversation_type is distinct from old.conversation_type
     or new.club_id is distinct from old.club_id
     or new.tenant_id is distinct from old.tenant_id
     or new.direct_pair_key is distinct from old.direct_pair_key
     or new.channel_key is distinct from old.channel_key
  then
    raise exception 'COMMS-ACT-03 conversation ownership mutation denied'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists communication_auth_conversations_immutable_trg
  on public.communication_conversations;
create trigger communication_auth_conversations_immutable_trg
  before update on public.communication_conversations
  for each row
  execute function public.communication_auth_reject_conversation_ownership_mutation();

create or replace function public.communication_auth_reject_message_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_id is distinct from old.message_id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_participant_id is distinct from old.sender_participant_id
     or new.position is distinct from old.position
  then
    raise exception 'COMMS-ACT-03 message identity mutation denied'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists communication_auth_messages_immutable_trg
  on public.communication_messages;
create trigger communication_auth_messages_immutable_trg
  before update on public.communication_messages
  for each row
  execute function public.communication_auth_reject_message_identity_mutation();

create or replace function public.communication_auth_reject_participant_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.participant_id is distinct from old.participant_id
  then
    raise exception 'COMMS-ACT-03 participant identity mutation denied'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists communication_auth_participants_immutable_trg
  on public.communication_conversation_participants;
create trigger communication_auth_participants_immutable_trg
  before update on public.communication_conversation_participants
  for each row
  execute function public.communication_auth_reject_participant_identity_mutation();

-- Revoke helper execute by default; grant only authenticated execute on SELECT gates
revoke all on function public.communication_auth_uid_text() from public, anon, authenticated;
revoke all on function public.communication_auth_is_active_club_member(text) from public, anon, authenticated;
revoke all on function public.communication_auth_can_select_club_conversation(text) from public, anon, authenticated;
revoke all on function public.communication_auth_reject_conversation_ownership_mutation() from public, anon, authenticated;
revoke all on function public.communication_auth_reject_message_identity_mutation() from public, anon, authenticated;
revoke all on function public.communication_auth_reject_participant_identity_mutation() from public, anon, authenticated;

grant execute on function public.communication_auth_uid_text() to authenticated;
grant execute on function public.communication_auth_is_active_club_member(text) to authenticated;
grant execute on function public.communication_auth_can_select_club_conversation(text) to authenticated;
-- Trigger functions: no client execute grant

-- ─── 2. Keep deny-all baseline; add Club SELECT policies (permissive OR) ─────
-- Deny-all policies remain for FOR ALL using(false). Additional SELECT policies
-- grant Club members row visibility. Without GRANT SELECT, clients still cannot
-- read — grants below are narrow SELECT only.

drop policy if exists communication_conversations_club_select
  on public.communication_conversations;
create policy communication_conversations_club_select
  on public.communication_conversations
  for select
  to authenticated
  using (
    conversation_type = 'CLUB'
    and club_id is not null
    and public.communication_auth_is_active_club_member(club_id)
  );

drop policy if exists communication_participants_club_select
  on public.communication_conversation_participants;
create policy communication_participants_club_select
  on public.communication_conversation_participants
  for select
  to authenticated
  using (
    public.communication_auth_can_select_club_conversation(conversation_id)
  );

drop policy if exists communication_messages_club_select
  on public.communication_messages;
create policy communication_messages_club_select
  on public.communication_messages
  for select
  to authenticated
  using (
    public.communication_auth_can_select_club_conversation(conversation_id)
  );

drop policy if exists communication_reactions_club_select
  on public.communication_message_reactions;
create policy communication_reactions_club_select
  on public.communication_message_reactions
  for select
  to authenticated
  using (
    public.communication_auth_can_select_club_conversation(conversation_id)
  );

drop policy if exists communication_pinned_messages_club_select
  on public.communication_pinned_messages;
create policy communication_pinned_messages_club_select
  on public.communication_pinned_messages
  for select
  to authenticated
  using (
    public.communication_auth_can_select_club_conversation(conversation_id)
  );

drop policy if exists communication_read_cursors_club_own_select
  on public.communication_read_cursors;
create policy communication_read_cursors_club_own_select
  on public.communication_read_cursors
  for select
  to authenticated
  using (
    participant_id = public.communication_auth_uid_text()
    and public.communication_auth_can_select_club_conversation(conversation_id)
  );

-- ─── 3. Narrow SELECT grants (no INSERT/UPDATE/DELETE for clients) ──────────
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

grant select on public.communication_conversations to authenticated;
grant select on public.communication_conversation_participants to authenticated;
grant select on public.communication_messages to authenticated;
grant select on public.communication_message_reactions to authenticated;
grant select on public.communication_pinned_messages to authenticated;
grant select on public.communication_read_cursors to authenticated;

-- Explicit: no grants on write-sensitive / Direct / Community / System authority tables
-- (revoked above): position_counters, direct_requests, user_blocks, reports,
-- moderation_actions, community_restrictions, idempotency, persistence_events

revoke all on function public.communication_allocate_message_position(text)
  from public, anon, authenticated;
revoke all on function public.communication_advance_read_cursor(text, text, timestamptz, text, bigint)
  from public, anon, authenticated;

-- ─── 4. Realtime remains disabled ────────────────────────────────────────────
-- Do NOT run: alter publication supabase_realtime add table …

-- =============================================================================
-- END COMMS-ACT-03 package
-- MIGRATION_STATUS = AUTHORED_NOT_APPLIED
-- CLIENT_RLS_POLICY = CLUB_SELECT_READY_NOT_APPLIED
-- DIRECT_CLIENT_RLS = TRUSTED_BACKEND_ONLY
-- SYSTEM_CLIENT_RLS = TRUSTED_BACKEND_ONLY
-- COMMUNITY_CLIENT_RLS = BLOCKED_FAIL_CLOSED
-- REALTIME_PUBLICATION = DEFERRED_NOT_ENABLED
-- SQL_APPLY = DEFERRED_OWNER_GO_STAGING_ONLY
-- =============================================================================
