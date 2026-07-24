# COMMS-03 — Club Communication

**Phase:** COMMS-03
**Status:** Implemented (application/domain capability; not production-wired)
**Module:** `src/features/communication/`
**Public barrel:** `src/features/communication/index.js`
**Tests:** `tests/communication-club-communication.test.js`
**Depends on:** COMMS-01 contracts + COMMS-02 application/port patterns

---

## Implementation inventory

| Area | Path |
|------|------|
| Channel kind / membership / access constants | `constants/clubChannelKinds.js`, `clubMembershipStatus.js`, `clubCommunicationAccess.js` |
| Channel identity / access / summary / pin contracts | `contracts/clubChannel.js`, `clubAccessDecision.js`, `clubMembershipFact.js`, `clubChannelSummary.js`, `clubPinnedMessage.js` |
| Access + projection rules | `domain/clubAccessRules.js`, `clubCommunicationProjection.js` |
| Repository & policy ports | `ports/clubChannelRepositoryPort.js`, `clubMembershipReaderPort.js`, `clubCommunicationPolicyPorts.js` |
| In-memory test doubles | `repositories/inMemoryClub.js` (**tests only**) |
| Application service | `application/ClubCommunicationApplicationService.js`, `createClubCommunicationApplication.js` |
| Public exports | `index.js` |
| Docs | `docs/communication-foundation/comms-03/03_CLUB_COMMUNICATION.md` |

---

## Public exports (COMMS-03 additions)

Import only from `src/features/communication`.

- Phase: `COMMUNICATION_FOUNDATION_PHASE` (`id: "COMMS-03"`)
- Taxonomy: `CLUB_CHANNEL_KIND`, `CLUB_MEMBERSHIP_STATUS`, `CLUB_COMMUNICATION_ACCESS_*`
- Contracts: `createClubChannelIdentityContract`, `createClubAccessDecisionContract`, `createClubMembershipFactContract`, `createClubChannelSummaryContract`, `createClubPinnedMessageContract`
- Domain: `resolveClubChannelIdentity`, `evaluateClubChannelAccess`, `buildClubChannelSummary`, …
- Application: `createClubCommunicationApplication`, `createClubCommunicationApplicationService`, `createMemoryClubMembershipReader`
- Ports: `ClubChannelRepository`, `ClubMessageRepository`, `ClubReadCursorRepository`, `ClubPinnedMessageRepository`, `ClubMembershipReader`, `ClubCommunicationAccessPolicy`, `TeamAccessPolicy`
- Test doubles: `createInMemoryClubCommunicationRepositories`

---

## Club Communication invariants

1. Conversation type for club rooms remains `CLUB` (COMMS-00 taxonomy).
2. Every CLUB conversation / channel requires `clubId`.
3. Channel kind must be one of: `GENERAL` | `ANNOUNCEMENT` | `PRIVATE` | `TEAM` | `MANAGEMENT`.
4. `channelKey` is immutable and canonical; display `name` is mutable metadata only.
5. A channel cannot be moved to another club.
6. Default `GENERAL` / `ANNOUNCEMENT` resolve idempotently per club (no duplicate defaults).
7. Club Management is the sole SoT for membership / club roles; Communication reads via `ClubMembershipReader`.
8. Non-ACTIVE membership cannot join default rooms or send messages.
9. `ANNOUNCEMENT` send is gated by `ClubCommunicationAccessPolicy` (no hard-coded Club owner/manager roles).
10. `PRIVATE` requires explicit channel participants (plus ACTIVE membership baseline).
11. `TEAM` access is decided by `TeamAccessPolicy`; `MANAGEMENT` by `ClubCommunicationAccessPolicy`.
12. Channel participant lifecycle reuses COMMS-01; duplicate ACTIVE participants are rejected.
13. Membership reconciliation may suspend/remove channel participants; it never writes Club membership.
14. Archived / non-ACTIVE channels reject new messages.
15. Reply targets and pin targets must belong to the same channel.
16. Pin requires channel admin policy/role; duplicate pin is rejected; unpin is idempotent.
17. Read cursors advance monotonically (COMMS-01).
18. Channel summary is deterministic and identifier-oriented (no club avatar / branding / full membership profile SoT).
19. Ports remain persistence-agnostic; unimplemented ports throw `PORT_OPERATION_UNIMPLEMENTED`.

---

## Application capabilities

| Capability | API |
|------------|-----|
| Resolve defaults | `createOrResolveDefaultClubChannels` |
| Create channel | `createClubChannel` |
| Update metadata | `updateClubChannelMetadata` |
| Archive | `archiveClubChannel` |
| Participants | `addClubChannelParticipant` / `suspend…` / `remove…` / `changeClubChannelParticipantRole` |
| Membership sync | `synchronizeClubMembershipAccess` |
| Send | `sendClubMessage` |
| Pin / unpin | `pinClubMessage` / `unpinClubMessage` |
| Read | `markClubChannelRead` |
| Summary | `buildClubChannelSummary` / `listClubChannelSummaries` |

Composition: `createClubCommunicationApplication({ useInMemoryRepositories: true, … })` for tests only.

---

## Dependency boundary with Club Management

| Concern | Owner |
|---------|-------|
| Club identity / lifecycle | **Club Management** |
| Membership ACTIVE / SUSPENDED / REMOVED | **Club Management** (read via `ClubMembershipReader`) |
| Club governance roles | **Club Management** (opaque `externalRoleFacts` + policy adapters) |
| Club channel rooms + messages + pins + read cursors | **Communication Foundation** |
| Team roster | **Team / Club** (via `TeamAccessPolicy` only) |

Communication **must not**:

- write Club membership;
- hard-code Club role enums as authorization SoT;
- store club avatar / branding as Communication SoT;
- call Club Management runtime / database from this phase.

---

## Explicit non-scope (COMMS-03)

- No SQL / migration / Supabase / RLS / production database
- No websocket / realtime subscription runtime
- No notification / push delivery
- No file upload, UI, routing, mobile app
- No Community Chat product depth (COMMS-04)
- No package / lockfile changes
- No edits to Club Management, CRM, Notification, Player, Competition, Platform Core trees
- In-memory repositories are **not** production SoT

---

## COMMS-05 readiness

**READY** for Persistence & Realtime when Community ports from COMMS-04 are implemented against production storage.

Prior Community readiness note (COMMS-04): completed — see [`../comms-04/04_COMMUNITY_COMMUNICATION.md`](../comms-04/04_COMMUNITY_COMMUNICATION.md).

**READY_WITH_CONDITIONS** for Community Communication (historical COMMS-03 note):

1. Reuse COMMS-01 conversation/participant/message contracts; do not fork identifiers.
2. Keep Club Communication ports/application separate; Community rooms are `COMMUNITY` type and require `tenantId`.
3. Consume community / tenant policy only via ports — do not invent a second community membership SoT inside Communication.
4. Still no SQL until COMMS-05 unless Owner expands scope.
5. Keep CRM `/crm/messages` and Notification inbox out of Communication SoT.
