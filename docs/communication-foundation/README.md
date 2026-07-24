# Communication Foundation

**Platform Core capability** for PICK_VN conversational messaging.
**Experience surface (later):** Experience Channels → Messaging & Community Experience.

| Phase | Status | Docs |
|-------|--------|------|
| **COMMS-00** Architecture & Boundary Audit | Complete | [`comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md`](./comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md) |
| **COMMS-01** Messaging Domain Foundation | Complete (domain-only) | [`comms-01/01_MESSAGING_DOMAIN_FOUNDATION.md`](./comms-01/01_MESSAGING_DOMAIN_FOUNDATION.md) |
| **COMMS-02** Direct Messaging | Complete (app/domain; not production-wired) | [`comms-02/02_DIRECT_MESSAGING.md`](./comms-02/02_DIRECT_MESSAGING.md) |
| **COMMS-03** Club Communication | Complete (app/domain; not production-wired) | [`comms-03/03_CLUB_COMMUNICATION.md`](./comms-03/03_CLUB_COMMUNICATION.md) |
| **COMMS-04** Community Communication | Complete (app/domain; not production-wired) | [`comms-04/04_COMMUNITY_COMMUNICATION.md`](./comms-04/04_COMMUNITY_COMMUNICATION.md) |
| **COMMS-05** Persistence & Realtime | Authored (SQL + adapters; **not applied** / not remote-wired) | [`comms-05/05_PERSISTENCE_AND_REALTIME.md`](./comms-05/05_PERSISTENCE_AND_REALTIME.md) |
| COMMS-06 … COMMS-07 | Planned | See roadmap in COMMS-00 |

**Runtime module:** `src/features/communication/` — contracts, domain, ports, Direct + Club + Community application, persistence adapters + realtime foundation; **not** Staging/Production applied.

## Hard boundary

Communication Foundation owns **conversations and messages**.
It does **not** own Identity, Player profile, Club membership, Notification delivery, Competition runtime, generic Storage, tenant lifecycle, or global audit persistence.

## Adjacent (not Communication)

| Concern | Owner |
|---------|--------|
| CRM outreach `/crm/messages` | CRM (compatibility shell) |
| Notification inbox | Notification Foundation |
| Match / referee / TT realtime | Competition / Referee / Team Tournament |

See COMMS-00 for ownership, dependency status, and phase readiness.

## COMMS-04 snapshot

- Community channel kinds: `LOBBY` | `TOPIC` | `REGION` | `SUPPORT`
- Visibility: `PUBLIC` | `JOIN_REQUIRED` | `RESTRICTED` | `READ_ONLY`
- Deterministic default lobby key per tenant (`community:{tenantId}:LOBBY`)
- Membership consumed via `CommunityMembershipReader` (external SoT)
- Policy ports for access + moderation; restriction repo for ban/suspend evidence
- Slow-mode foundation (ClockPort + last-send); pin / report / hide / ban / restore
- Application: lobby resolve, channels, participants, send, pin, read, summary, moderation
- Persistence-agnostic ports + in-memory test doubles only
- Public barrel: `src/features/communication/index.js`

## COMMS-05 snapshot

- SQL package: `docs/supabase-communication-comms05.sql` (`AUTHORED_NOT_APPLIED`)
- Fail-closed client RLS (deny-all); trusted-backend adapters
- Realtime foundation via `RealtimeDeliveryPort` (no remote publication)
- Activation gates: Staging apply, Production, client RLS, realtime publication, Notification outbox

**Next:** COMMS-06 UI — see readiness in [`comms-05/05_PERSISTENCE_AND_REALTIME.md`](./comms-05/05_PERSISTENCE_AND_REALTIME.md).
