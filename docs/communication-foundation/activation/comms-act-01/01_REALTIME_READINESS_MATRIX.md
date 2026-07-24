# COMMS-ACT-01 — Realtime Readiness Matrix

**Gate:** Separate from SQL apply.  
**Status:** `REALTIME_PUBLICATION = DEFERRED_NOT_ENABLED`  
**Do not** enable publication in COMMS-ACT-01 or in the same step as schema apply.

## Tables / events (planned)

| Table (candidate) | Events | Publish? | Notes |
|-------------------|--------|----------|-------|
| `communication_messages` | INSERT/UPDATE | Later GO only | Conversation-scoped filter required |
| `communication_conversation_participants` | INSERT/UPDATE/DELETE | Optional later | Access/ACL reload |
| `communication_read_cursors` | INSERT/UPDATE | Optional later | Unread projection |
| `communication_pinned_messages` | INSERT/DELETE | Optional later | Pin reload |
| `communication_idempotency` | — | **NEVER** unscoped | Not a client feed |
| `communication_persistence_events` | — | **NEVER** unscoped | Outbox intent; not SoT for UI |
| `communication_user_blocks` | — | **NEVER** unscoped | Privacy-sensitive |

Envelope event types (signal only): `MESSAGE_CREATED`, `MESSAGE_UPDATED`, `MESSAGE_HIDDEN`, `PARTICIPANT_CHANGED`, `ACCESS_CHANGED`, `READ_STATE_CHANGED`, `PIN_CHANGED`, `MODERATION_CHANGED`.

## Authorization / scope

| Rule | Requirement |
|------|-------------|
| Scope | Conversation-scoped only (`conversation_id=eq.…`) |
| Authorize-before-subscribe | Mandatory |
| Unscoped table subscribe | Invalid — drop |
| Persistence SoT | Envelope is `signalOnly: true` → UI reload from persistence |

## Catch-up / duplicates / unsubscribe

| Concern | Strategy |
|---------|----------|
| Catch-up | Reload thread / invalidate cache after signal; optional outbox cursor later |
| Duplicate suppression | Envelope id / event dedupe in runtime adapter |
| Malformed / out-of-scope | Drop + typed diagnostic |
| Unsubscribe | Provider unmount / conversation leave cleanup |

## Disable / rollback procedure

1. Remove Communication tables from `supabase_realtime` publication (if added).  
2. Force runtime realtime path unavailable / feature flag off.  
3. Confirm clients unsubscribe.  
4. Persistence + deny-all RLS remain.  
5. Capture incident note in evidence.

## Smoke tests (after separate Owner GO)

- [ ] Authorized participant receives signal → reload  
- [ ] Unauthorized subscribe denied / no data leak  
- [ ] Out-of-scope event dropped  
- [ ] Duplicate suppressed  
- [ ] Unsubscribe cleans channel  
- [ ] Disable procedure rehearsed  

## Activation condition

Flip `REALTIME_ACTIVATION_READY` only when:

1. Persistence apply verified  
2. Negative RLS package PASS (deny-all or certified client policies)  
3. Direct/Club/Community smoke PASS  
4. This matrix completed with Owner realtime GO  
5. Rollback rehearsed  

Until then: **Realtime = NOT ENABLED**.
