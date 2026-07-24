# COMMS-04 — Community Communication

**Phase:** COMMS-04
**Status:** Implemented (application/domain capability; not production-wired)
**Module:** `src/features/communication/`
**Public barrel:** `src/features/communication/index.js`
**Tests:** `tests/communication-community-communication.test.js`
**Depends on:** COMMS-01 contracts + COMMS-02/03 application/port patterns

---

## Implementation inventory

| Area | Path |
|------|------|
| Channel kind / visibility / lifecycle / membership / access / restriction constants | `constants/communityChannelKinds.js`, `communityChannelVisibility.js`, `communityChannelLifecycle.js`, `communityMembershipStatus.js`, `communityCommunicationAccess.js`, `communityRestrictionStatus.js` |
| Channel identity / access / membership / restriction / summary / pin / slow-mode contracts | `contracts/communityChannel.js`, `communityAccessDecision.js`, `communityMembershipFact.js`, `communityRestriction.js`, `communityChannelSummary.js`, `communityPinnedMessage.js`, `communitySlowMode.js` |
| Access + projection rules | `domain/communityAccessRules.js`, `communityCommunicationProjection.js` |
| Repository & policy ports | `ports/communityChannelRepositoryPort.js`, `communityMembershipReaderPort.js`, `communityCommunicationPolicyPorts.js`, `communityRestrictionRepositoryPort.js` |
| In-memory test doubles | `repositories/inMemoryCommunity.js` (**tests only**) |
| Application service | `application/CommunityCommunicationApplicationService.js`, `createCommunityCommunicationApplication.js` |
| Public exports | `index.js` |
| Docs | `docs/communication-foundation/comms-04/04_COMMUNITY_COMMUNICATION.md` |

---

## Public exports (COMMS-04 additions)

Import only from `src/features/communication`.

- Phase: `COMMUNICATION_FOUNDATION_PHASE` (`id: "COMMS-04"`)
- Taxonomy: `COMMUNITY_CHANNEL_KIND`, `COMMUNITY_CHANNEL_VISIBILITY`, `COMMUNITY_CHANNEL_LIFECYCLE`, `COMMUNITY_MEMBERSHIP_STATUS`, `COMMUNITY_COMMUNICATION_ACCESS_*`, `COMMUNITY_RESTRICTION_*`
- Contracts: `createCommunityChannelIdentityContract`, `createCommunityAccessDecisionContract`, `createCommunityMembershipFactContract`, `createCommunityRestrictionContract`, `createCommunityChannelSummaryContract`, `createCommunityPinnedMessageContract`, `evaluateCommunitySlowMode`
- Domain: `resolveCommunityChannelIdentity`, `evaluateCommunityChannelAccess`, `buildCommunityChannelSummary`, …
- Application: `createCommunityCommunicationApplication`, `createCommunityCommunicationApplicationService`, `createMemoryCommunityMembershipReader`
- Ports: `CommunityChannelRepository`, `CommunityMessageRepository`, `CommunityReadCursorRepository`, `CommunityPinnedMessageRepository`, `CommunityMembershipReader`, `CommunityAccessPolicy`, `CommunityModerationPolicy`, `CommunityRestrictionRepository`
- Test doubles: `createInMemoryCommunityCommunicationRepositories`

---

## Community Communication invariants

1. Conversation type for community rooms remains `COMMUNITY` (COMMS-00 taxonomy).
2. Every COMMUNITY conversation / channel requires `tenantId`.
3. Channel kind must be one of: `LOBBY` | `TOPIC` | `REGION` | `SUPPORT`.
4. Visibility must be one of: `PUBLIC` | `JOIN_REQUIRED` | `RESTRICTED` | `READ_ONLY`.
5. `channelKey` is immutable and canonical; display `name` is mutable metadata only.
6. A channel cannot be moved to another tenant.
7. Default `LOBBY` resolves idempotently per tenant (no duplicate active lobby).
8. Community / tenant membership is consumed via `CommunityMembershipReader` — Communication does not invent a second membership SoT.
9. Access decisions are typed: `ALLOW` | `JOIN_REQUIRED` | `READ_ONLY` | `DENY` with deterministic reason codes.
10. Invalid / inactive identity → `DENY`.
11. Community-banned actors → `DENY` (join and send).
12. Suspended channel participants cannot send.
13. Archived / suspended channels reject new messages.
14. `READ_ONLY` allows read but not send; `JOIN_REQUIRED` requires active membership; `RESTRICTED` requires explicit participant or policy allow.
15. Channel participant lifecycle reuses COMMS-01; duplicate ACTIVE participants are rejected; leave is idempotent.
16. Slow mode is deterministic via `ClockPort` + last-send lookup; moderator bypass only via moderation policy port.
17. Report / hide / ban / restore reuse COMMS-01 report & moderation contracts (extended with `HIDE_MESSAGE` / `BAN_PARTICIPANT` / `RESTORE_PARTICIPANT`).
18. Pin requires moderation/admin authorization; pin target must be same channel; duplicate pin rejected; unpin idempotent.
19. Read cursors advance monotonically (COMMS-01).
20. Channel summary is deterministic and identifier-oriented (no avatar / tenant branding / profile SoT).
21. Ports remain persistence-agnostic; unimplemented ports throw `PORT_OPERATION_UNIMPLEMENTED`.

---

## Application capabilities

| Capability | API |
|------------|-----|
| Resolve lobby | `createOrResolveCommunityLobby` |
| Create channel | `createCommunityChannel` |
| Update metadata | `updateCommunityChannelMetadata` |
| Suspend / archive | `suspendCommunityChannel` / `archiveCommunityChannel` |
| Participation | `joinCommunityChannel` / `leaveCommunityChannel` / `addRestrictedChannelParticipant` / `suspendCommunityChannelParticipant` / `removeCommunityChannelParticipant` |
| Access sync | `reconcileCommunityAccess` |
| Send | `sendCommunityMessage` |
| Pin / unpin | `pinCommunityMessage` / `unpinCommunityMessage` |
| Read | `markCommunityChannelRead` |
| Summary | `buildCommunityChannelSummary` / `listCommunityChannelSummaries` |
| Moderation | `reportCommunityMessage` / `hideCommunityMessage` / `banCommunityParticipant` / `restoreCommunityParticipant` |

Composition: `createCommunityCommunicationApplication({ useInMemoryRepositories: true, … })` for tests only.

---

## Membership / moderation boundary

| Concern | Owner |
|---------|-------|
| Tenant lifecycle / branding | **Platform Core / Tenant** |
| Community membership ACTIVE / SUSPENDED / REMOVED | **External SoT** (read via `CommunityMembershipReader`) |
| Community governance / moderator roles | **External policy adapters** (`CommunityAccessPolicy` / `CommunityModerationPolicy`) |
| Community channel rooms + messages + pins + read cursors | **Communication Foundation** |
| Communication-owned ban/suspend evidence | **Communication** via `CommunityRestrictionRepository` (not Platform membership SoT) |

Communication **must not**:

- write Platform / CRM / Club / Competition membership;
- hard-code subscription, CRM segment, Club role, or Competition participant as community membership;
- store avatar / tenant branding as Communication SoT;
- call database / Supabase / realtime / notification delivery from this phase.

---

## Explicit non-scope (COMMS-04)

- No SQL / migration / Supabase / RLS / production database
- No websocket / realtime subscription runtime
- No notification / push delivery
- No file upload, UI, routing, mobile app
- No Marketplace product surface (future TOPIC / business adapter only)
- No AI moderation / keyword filter production
- No package / lockfile changes
- No edits to Club Management, CRM, Notification, Player, Competition, Platform Core trees
- In-memory repositories are **not** production SoT

---

## COMMS-05 readiness

**SATISFIED_WITH_ACTIVATION_GATES** — see [`../comms-05/05_PERSISTENCE_AND_REALTIME.md`](../comms-05/05_PERSISTENCE_AND_REALTIME.md).

COMMS-05 authored production-oriented adapters + SQL package without changing Community contracts.
Remaining gates: Staging/Production SQL apply, client RLS activation, realtime publication, Notification outbox.
Community membership SQL helper remains an activation blocker for client RLS (app-layer `CommunityMembershipReader` still required).
