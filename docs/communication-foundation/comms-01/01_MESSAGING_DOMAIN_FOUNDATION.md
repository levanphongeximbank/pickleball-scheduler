# COMMS-01 — Messaging Domain Foundation

**Phase:** COMMS-01
**Status:** Implemented (domain-only; not production-wired)
**Module:** `src/features/communication/`
**Public barrel:** `src/features/communication/index.js`
**Tests:** `tests/communication-foundation.test.js`

---

## Implementation inventory

| Area | Path |
|------|------|
| Constants / taxonomy | `src/features/communication/constants/` |
| Typed errors | `src/features/communication/errors/` |
| Contracts | `src/features/communication/contracts/` |
| Domain rules | `src/features/communication/domain/` |
| Adapter ports | `src/features/communication/ports/` |
| Public exports | `src/features/communication/index.js` |

Canonical taxonomy (COMMS-00): `DIRECT` | `CLUB` | `COMMUNITY` | `SYSTEM`.

---

## Canonical exports

Import only from `src/features/communication` (or `.../index.js`).

Key surfaces:

- Phase metadata: `COMMUNICATION_FOUNDATION_PHASE`
- Errors: `CommunicationFoundationError`, `COMMUNICATION_FOUNDATION_ERROR_CODE`
- Contracts: `createConversationContract`, `createMessageContract`, `createConversationParticipantContract`, `createReactionContract`, `createReadCursorContract`, `createAttachmentReferenceContract`, `createUserBlockContract`, `createMessageReportContract`, `createModerationActionContract`
- Domain: `createValidConversation`, `addParticipant`, `assertCanSendMessage`, `createMessageForConversation`, `assertReplyTargetInConversation`, `transitionMessageStatus`, `advanceReadCursor`, validators for attachment/reaction/block/report/moderation
- Ports: `createUnimplemented*Port` + `matches*Port` for Identity, Player, Club, Tenant, Notification, Realtime, File Storage, Audit, Clock, IdProvider

---

## Domain invariants enforced

1. Conversation type must be one of the locked taxonomy values.
2. `CLUB` requires `clubId`; `COMMUNITY` requires `tenantId`.
3. `DIRECT` seed with participants requires exactly two distinct participants.
4. Participant ids are unique within an active conversation membership.
5. Conversation / participant / message status transitions follow allow-lists; terminal states do not reopen illegally.
6. Send requires ACTIVE conversation + ACTIVE participant belonging to that conversation.
7. Reply target must exist in the **same** conversation.
8. Read cursor `lastReadAt` only advances forward (monotonic).
9. Attachment refs require path; `sizeBytes` if present must be finite `>= 0`.
10. Reactions require non-empty emoji within length bound.
11. User cannot block themselves.
12. Moderation actions require the correct target fields per action type.
13. Adapter ports throw `PORT_OPERATION_UNIMPLEMENTED` — no runtime coupling in COMMS-01.

---

## Explicit non-scope (COMMS-01)

- No SQL / migration / Supabase / RLS
- No realtime subscription runtime
- No file upload / notification delivery / UI / routing
- No Direct/Club/Community deep product policy beyond foundation invariants
- No edits to Identity, Club, Player, Notification, Competition, CRM, Platform Core trees
- No package / lockfile changes

---

## COMMS-02 readiness

**COMPLETE** — see [`../comms-02/02_DIRECT_MESSAGING.md`](../comms-02/02_DIRECT_MESSAGING.md).

Historical conditions (satisfied by COMMS-02 without SQL):

1. Build `DIRECT` application services on top of these contracts (still persistence-optional / in-memory OK for early COMMS-02).
2. Wire Identity actor checks via `IdentityActorPort` (still no SoT ownership).
3. Do not introduce SQL until COMMS-05 unless Owner explicitly expands scope.
4. Keep CRM `/crm/messages` and Notification inbox out of Communication SoT.
