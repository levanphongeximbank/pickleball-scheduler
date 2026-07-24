# COMMS-05 — Persistence & Realtime Foundation

**Status:** AUTHORED in repository — **NOT applied** to Staging/Production.  
**Module:** `src/features/communication/persistence/`  
**SQL:** `docs/supabase-communication-comms05.sql`  
**Verdict class:** Local/code ready with explicit activation blockers.

---

## Persistence ownership

| Owns | Does not own |
|------|----------------|
| `public.communication_*` tables | Identity `profiles` / `audit_logs` |
| Conversation / message / cursor / pin / block / report / moderation / restriction rows | Club membership SoT (`club_members`) |
| Communication idempotency + persistence event intents | Notification delivery / inbox |
| Repository adapters mapping rows ↔ canonical COMMS contracts | Player display profile |
| RealtimeDeliveryPort foundation (signal only) | Competition / referee / TT realtime channels |
| | Tenant lifecycle (`venues`) |

---

## Table / object inventory

| Object | Purpose |
|--------|---------|
| `communication_conversations` | DIRECT / CLUB / COMMUNITY (+ channel metadata) |
| `communication_conversation_participants` | Conversation membership (not Club SoT) |
| `communication_message_position_counters` | Server ordering authority |
| `communication_messages` | Messages + attachment refs + position |
| `communication_message_reactions` | Reactions |
| `communication_read_cursors` | Read cursors |
| `communication_direct_requests` | Direct conversation requests |
| `communication_pinned_messages` | Pins |
| `communication_user_blocks` | DM blocks |
| `communication_message_reports` | Reports |
| `communication_moderation_actions` | Moderation log |
| `communication_community_restrictions` | Ban / suspend evidence |
| `communication_idempotency` | Command/send idempotency ledger |
| `communication_persistence_events` | Minimal outbox / event intent |
| `communication_allocate_message_position()` | Position RPC |
| `communication_advance_read_cursor()` | Monotonic cursor RPC |
| Reply / pin same-conversation triggers | Invariant guards |

---

## Adapter inventory

Factory: `createSupabaseCommunicationRepositories(client)`

| Adapter | Port |
|---------|------|
| `directConversations` | DirectConversationRepository |
| `directRequests` | DirectConversationRequestRepository |
| `directMessages` | DirectMessageRepository |
| `directReadCursors` | DirectReadCursorRepository |
| `blockState` / `userBlocks` | BlockStateReader + block persistence |
| `clubChannels` | ClubChannelRepository |
| `clubMessages` | ClubMessageRepository |
| `clubReadCursors` | ClubReadCursorRepository |
| `clubPins` | ClubPinnedMessageRepository |
| `communityChannels` | CommunityChannelRepository |
| `communityMessages` | CommunityMessageRepository (+ `findLatestBySender`) |
| `communityReadCursors` | CommunityReadCursorRepository |
| `communityPins` | CommunityPinnedMessageRepository |
| `communityRestrictions` | CommunityRestrictionRepository |
| `communityReports` | CommunityReportRepository |
| `communityModerationActions` | CommunityModerationActionRepository |
| `unitOfWork` | Optional atomic multi-record capability |

Realtime:

| Factory | Role |
|---------|------|
| `createInMemoryRealtimeDeliveryAdapter` | Local/test RealtimeDeliveryPort |
| `createScopedRealtimeDeliveryAdapter` | Authorized scoped scaffold (no remote) |
| `createConversationRealtimeSubscriptionDescriptor` | Conversation-scoped descriptor |
| `createCommunicationRealtimeEventEnvelope` | Deterministic signal envelope |

Outbox: `createCommunicationPersistenceEventRepository` — records intents; Notification/Audit delivery deferred.

---

## RLS matrix

| Table | Client (anon/authenticated) | Service-role / trusted backend |
|-------|----------------------------|--------------------------------|
| All `communication_*` | **Deny-all** (`USING (false)` / `WITH CHECK (false)`); grants revoked | Bypasses RLS (Postgres default) |
| Position / cursor RPCs | Execute revoked | Allowed for trusted writers |

**CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED**

Planned (not enabled) client policy shapes:

| Type | Future gate |
|------|-------------|
| DIRECT | Active participant row for `auth.uid()` |
| CLUB | Owner-approved `phase42_active_club_member_id(club_id)` — **OWNER_APPROVAL_REQUIRED** |
| COMMUNITY tenant stamp | `tenant_id = user_venue_id()` |
| COMMUNITY membership | **ACTIVATION_BLOCKER** until Platform publishes SQL helper |

No `USING (true)` / `WITH CHECK (true)`.

---

## Realtime event matrix

| Event | When | Consumer action |
|-------|------|-----------------|
| MESSAGE_CREATED | After durable message insert | Reload thread / invalidate cache |
| MESSAGE_UPDATED / MESSAGE_HIDDEN | Edit / hide / delete tombstone | Reload message |
| PARTICIPANT_CHANGED / ACCESS_CHANGED | Join / leave / role / access | Reload participants / ACL |
| READ_STATE_CHANGED | Cursor advance | Update unread projection |
| PIN_CHANGED | Pin / unpin | Reload pins |
| MODERATION_CHANGED | Moderation action | Reload moderation view |

Rules:

- Persistence is SoT; envelope is `signalOnly: true`.
- Subscribe only after conversation authorization.
- Descriptor is conversation-scoped (`conversation_id=eq.…`).
- **REALTIME_PUBLICATION = DEFERRED_NOT_ENABLED** (no `supabase_realtime` add in this package).
- Never treat unscoped table subscribe as valid.

---

## Ordering / pagination strategy

1. Allocate `position` via `communication_allocate_message_position` (not client clock).
2. Unique `(conversation_id, position)`.
3. List / latest use `ORDER BY position`.
4. Pagination cursor: `afterPosition` / `beforePosition` (not offset).
5. Tie-break display may still use `message_id` in app projections; DB authority is `position`.

---

## Idempotency strategy

| Concern | Mechanism |
|---------|-----------|
| Message insert-once | `message_id` PK |
| Client retry | optional `client_idempotency_key` unique per conversation |
| Direct conversation | unique `direct_pair_key` |
| Pending request | partial unique on `pair_key` where PENDING |
| Default club GENERAL | unique `(club_id)` where kind GENERAL |
| Default community LOBBY | unique `(tenant_id)` where kind LOBBY |
| Channel key | unique `channel_key` |
| Pin | PK `(conversation_id, message_id)` |
| Command ledger | `communication_idempotency (operation_type, idempotency_key)` |

---

## Migration application gate

**SQL_APPLY = DEFERRED_STAGING_FIRST_GATE**

Do **not** apply this package from COMMS-05 workstream.

Before any future apply:

1. Owner GO for Staging-first.
2. Backup / restore plan approved.
3. Prerequisites verified (`profiles`, `user_venue_id`, Club helpers if client RLS expands).
4. Static SQL tests green on the authored package.
5. Separate apply PR / runbook (not this branch’s job).

---

## Staging rollout prerequisites

- [ ] Owner Staging GO
- [ ] Backup snapshot
- [ ] Apply forward SQL only (never production-first)
- [ ] Verify RLS enabled + deny-all still present unless client policies explicitly activated
- [ ] Smoke trusted-backend adapter against Staging with service-role
- [ ] Confirm no realtime publication unless separate GO
- [ ] Regression: COMMS-01…05 unit suite

---

## Production rollout prerequisites

- [ ] Staging soak + QA sign-off
- [ ] Production backup
- [ ] Owner Production GO
- [ ] Client RLS activation decision documented (or remain fail-closed + trusted backend)
- [ ] Realtime publication GO separate from schema apply
- [ ] Notification integration still deferred unless Owner expands

---

## Backup / recovery requirements

- Pre-apply backup mandatory on Staging and Production.
- Rollback SQL is **destructive DROP** — safe only before data exists.
- After data exists: restore from backup; forward-fix preferred.
- Do not rely on DROP rollback for recovery with live messages.

---

## COMMS-06 UI readiness

**READY_WITH_CONDITIONS**

UI may begin against application services **only if**:

1. UI uses application ports / composers — not raw SQL rows.
2. Persistence wiring remains behind trusted adapters + activation gates.
3. No remote migration apply from UI workstream.
4. Realtime UI uses `RealtimeDeliveryPort` signals + reload pattern.
5. No Notification delivery UI claims until Notification integration gate clears.

---

## Explicit non-scope (COMMS-05)

- No Staging / Production migration apply
- No remote Supabase connection / data mutation
- No deploy
- No realtime publication enablement
- No UI / router
- No Notification delivery
- No package / lockfile changes
- No Club / Identity / Competition SoT changes

---

## Activation snapshot

| Gate | Value |
|------|-------|
| Local / code readiness | **READY** |
| Staging migration readiness | **BLOCKED** (Owner GO + backup) |
| Production readiness | **BLOCKED** |
| Realtime activation readiness | **BLOCKED** (`DEFERRED_NOT_ENABLED`) |
| Client RLS | **DEFERRED_FAIL_CLOSED** |
| Community membership SQL helper | **ACTIVATION_BLOCKER** |
| Club membership SQL helper reuse | **OWNER_APPROVAL_REQUIRED** |
