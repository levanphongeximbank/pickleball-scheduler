# Communication Foundation

**Platform Core capability** for PICK_VN conversational messaging.
**Experience surface (later):** Experience Channels → Messaging & Community Experience.

| Phase | Status | Docs |
|-------|--------|------|
| **COMMS-00** Architecture & Boundary Audit | Complete | [`comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md`](./comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md) |
| **COMMS-01** Messaging Domain Foundation | Complete (domain-only) | [`comms-01/01_MESSAGING_DOMAIN_FOUNDATION.md`](./comms-01/01_MESSAGING_DOMAIN_FOUNDATION.md) |
| **COMMS-02** Direct Messaging | Complete (app/domain; not production-wired) | [`comms-02/02_DIRECT_MESSAGING.md`](./comms-02/02_DIRECT_MESSAGING.md) |
| **COMMS-03** Club Communication | Complete (app/domain; not production-wired) | [`comms-03/03_CLUB_COMMUNICATION.md`](./comms-03/03_CLUB_COMMUNICATION.md) |
| COMMS-04 … COMMS-07 | Planned | See roadmap in COMMS-00 |

**Runtime module:** `src/features/communication/` — contracts, domain rules, ports, Direct Messaging + Club Communication application; not production-wired.

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

## COMMS-03 snapshot

- Club channel kinds: `GENERAL` | `ANNOUNCEMENT` | `PRIVATE` | `TEAM` | `MANAGEMENT`
- Deterministic default channel keys for `GENERAL` / `ANNOUNCEMENT`
- Membership consumed via `ClubMembershipReader` (Club Management remains SoT)
- Policy ports for announcement send, team, and management access (no hard-coded Club roles)
- Application: create/resolve channels, participants, send, pin, read, summary projection
- Persistence-agnostic ports + in-memory test doubles only
- Public barrel: `src/features/communication/index.js`

**Next:** COMMS-04 Community Communication — see readiness in [`comms-03/03_CLUB_COMMUNICATION.md`](./comms-03/03_CLUB_COMMUNICATION.md).
