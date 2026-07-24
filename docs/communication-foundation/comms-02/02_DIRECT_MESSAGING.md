# COMMS-02 — Direct Messaging

**Phase:** COMMS-02
**Status:** Implemented (application/domain capability; not production-wired)
**Module:** `src/features/communication/`
**Public barrel:** `src/features/communication/index.js`
**Tests:** `tests/communication-direct-messaging.test.js`
**Depends on:** COMMS-01 Messaging Domain Foundation (canonical contracts)

---

## Implementation inventory

| Area | Path |
|------|------|
| Access / request constants | `constants/directMessagingAccess.js`, `constants/conversationRequestStatus.js` |
| Direct pair / request / summary contracts | `contracts/directPair.js`, `conversationRequest.js`, `directAccessDecision.js`, `directConversationSummary.js` |
| Access / request / projection rules | `domain/directAccessRules.js`, `conversationRequestRules.js`, `directMessagingProjection.js` |
| Repository & policy ports | `ports/directConversationRepositoryPort.js`, `directConversationRequestRepositoryPort.js`, `directMessageRepositoryPort.js`, `directMessagingPolicyPorts.js` |
| In-memory test doubles | `repositories/inMemory.js` (**tests only**) |
| Application service | `application/DirectMessagingApplicationService.js`, `createDirectMessagingApplication.js` |
| Public exports | `index.js` |

---

## Public exports (COMMS-02 additions)

Import only from `src/features/communication`.

- Phase: `COMMUNICATION_FOUNDATION_PHASE` (`id: "COMMS-02"`)
- Access taxonomy: `DIRECT_MESSAGING_ACCESS_DECISION`, `DIRECT_MESSAGING_DENY_REASON`, `CONVERSATION_REQUEST_STATUS`
- Contracts: `createDirectPairContract`, `createDirectAccessDecisionContract`, `createConversationRequestContract`, `createDirectConversationSummaryContract`
- Domain: `resolveCanonicalDirectPair`, `evaluateDirectMessagingAccess`, `assertDirectAccessAllowed`, request transition helpers, `buildDirectConversationSummary`
- Application: `createDirectMessagingApplication`, `createDirectMessagingApplicationService`
- Ports: Direct conversation / request / message / read-cursor repositories, `BlockStateReader`, `DirectMessagingAccessPolicy`
- Test doubles: `createInMemoryDirectMessagingRepositories`, `createMemoryIdentityActorPort`, `createFixedClock`, `createSequentialIdProvider`

---

## Direct messaging invariants

1. A DIRECT pair is exactly two distinct opaque participant identifiers (no display name / email / phone as canonical id).
2. Pair ordering is canonical (lexicographic); the same two users always share one `pairKey` regardless of initiator order.
3. Actor opening a conversation must belong to the pair.
4. Access decisions are typed: `ALLOW` | `REQUEST_REQUIRED` | `DENY`.
5. Block (either direction) always overrides other policy → `DENY`.
6. Self-conversation, invalid identity, and inactive identity → `DENY` with stable reason codes.
7. External relationship policy is consumed only via `DirectMessagingAccessPolicy` — Communication does not hard-code Club/CRM/social rules.
8. At most one `PENDING` conversation request per pair.
9. Only recipient may accept/decline; only requester may cancel.
10. Terminal request statuses (`ACCEPTED` | `DECLINED` | `CANCELLED` | `EXPIRED`) do not transition again.
11. `openOrResolveDirectConversation` is idempotent per pair — no duplicate DIRECT conversations.
12. Send requires DIRECT type, both participants ACTIVE, sender membership, block check, and COMMS-01 message/reply rules.
13. Read cursor advances monotonically (COMMS-01 `advanceReadCursor`).
14. Inbox projection is deterministic and identifier-only (no avatar / display name / rating in Communication SoT).
15. Ports remain persistence-agnostic; unimplemented ports throw `PORT_OPERATION_UNIMPLEMENTED`.

### Deferred (explicit)

- **Request EXPIRED auto-transition:** status value is reserved; COMMS-02 does **not** wall-clock auto-expire without durable persistence + safe clock scheduling (defer to COMMS-05+).
- SQL / Supabase / RLS / realtime / notification delivery / UI (COMMS-05 / COMMS-06).

---

## Application capabilities

| Capability | API |
|------------|-----|
| Evaluate access | `directMessaging.evaluateAccess` |
| Request conversation | `directMessaging.requestDirectConversation` |
| Accept / decline / cancel request | `acceptDirectConversationRequest` / `decline…` / `cancel…` |
| Open or resolve pair | `openOrResolveDirectConversation` |
| Send message (+ reply) | `sendDirectMessage` |
| Mark read | `markDirectConversationRead` |
| Inbox projection | `buildDirectConversationSummary` / `listDirectConversationSummaries` |

Composition: `createDirectMessagingApplication({ useInMemoryRepositories: true, … })` for tests only.

---

## Explicit non-scope (COMMS-02)

- No SQL / migration / Supabase / RLS / production database
- No websocket / realtime subscription runtime
- No notification / push delivery
- No file upload, UI, routing, mobile app
- No Club Chat / Community Chat product depth
- No E2E encryption / voice-video / message search
- No package / lockfile changes
- No edits to CRM, Notification, Player, Club, Competition, Platform Core trees
- In-memory repositories are **not** production SoT

---

## COMMS-03 readiness

**COMPLETE** — see [`../comms-03/03_CLUB_COMMUNICATION.md`](../comms-03/03_CLUB_COMMUNICATION.md).

Historical conditions (satisfied by COMMS-03 without SQL):

1. Reuse COMMS-01 conversation/participant/message contracts; do not fork identifiers.
2. Consume Club membership via `ClubMembershipReader` — Communication must not own club membership writes.
3. Keep Direct Messaging ports/application separate; Club rooms are a different conversation type (`CLUB`).
4. Still no SQL until COMMS-05 unless Owner expands scope.
5. Keep CRM `/crm/messages` and Notification inbox out of Communication SoT.
