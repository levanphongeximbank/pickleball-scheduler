# Communication Foundation

**Platform Core capability** for PICK_VN conversational messaging.
**Experience surface (later):** Experience Channels → Messaging & Community Experience.

| Phase | Status | Docs |
|-------|--------|------|
| **COMMS-00** Architecture & Boundary Audit | Active (this package) | [`comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md`](./comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md) |
| COMMS-01 Messaging Domain Foundation | Not started | — |
| COMMS-02 … COMMS-07 | Planned | See roadmap in COMMS-00 |

## Hard boundary

Communication Foundation owns **conversations and messages**.
It does **not** own Identity, Player profile, Club membership, Notification delivery, Competition runtime, generic Storage, tenant lifecycle, or global audit persistence.

## Adjacent (not Communication)

| Concern | Owner |
|---------|--------|
| CRM outreach `/crm/messages` | CRM (compatibility shell) |
| Notification inbox | Notification Foundation |
| Match / referee / TT realtime | Competition / Referee / Team Tournament |

See COMMS-00 for ownership, dependency status, and COMMS-01 readiness.
