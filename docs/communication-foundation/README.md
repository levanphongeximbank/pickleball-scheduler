# Communication Foundation

**Platform Core capability** for PICK_VN conversational messaging.
**Experience surface:** Experience Channels → Messaging & Community Experience (`/messages`).

| Phase | Status | Docs |
|-------|--------|------|
| **COMMS-00** Architecture & Boundary Audit | Complete | [`comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md`](./comms-00/00_ARCHITECTURE_AND_BOUNDARY_AUDIT.md) |
| **COMMS-01** Messaging Domain Foundation | Complete (domain-only) | [`comms-01/01_MESSAGING_DOMAIN_FOUNDATION.md`](./comms-01/01_MESSAGING_DOMAIN_FOUNDATION.md) |
| **COMMS-02** Direct Messaging | Complete (app/domain; not production-wired) | [`comms-02/02_DIRECT_MESSAGING.md`](./comms-02/02_DIRECT_MESSAGING.md) |
| **COMMS-03** Club Communication | Complete (app/domain; not production-wired) | [`comms-03/03_CLUB_COMMUNICATION.md`](./comms-03/03_CLUB_COMMUNICATION.md) |
| **COMMS-04** Community Communication | Complete (app/domain; not production-wired) | [`comms-04/04_COMMUNITY_COMMUNICATION.md`](./comms-04/04_COMMUNITY_COMMUNICATION.md) |
| **COMMS-05** Persistence & Realtime | Authored (SQL + adapters; **not applied** / not remote-wired) | [`comms-05/05_PERSISTENCE_AND_REALTIME.md`](./comms-05/05_PERSISTENCE_AND_REALTIME.md) |
| **COMMS-06** Messaging Experience | Complete (UI + demo gateway; **not production data**) | [`comms-06/06_MESSAGING_EXPERIENCE.md`](./comms-06/06_MESSAGING_EXPERIENCE.md) |
| COMMS-07 | Planned | Integration / activation hardening |

**Runtime module:** `src/features/communication/` — contracts, domain, ports, Direct + Club + Community application, persistence adapters + realtime foundation, Messaging Experience UI.
**Persistence:** not Staging/Production applied. **Experience:** demo/in-memory gateway only.

## Hard boundary

Communication Foundation owns **conversations and messages**.
It does **not** own Identity, Player profile, Club membership, Notification delivery, Competition runtime, generic Storage, tenant lifecycle, or global audit persistence.

## Adjacent (not Communication)

| Concern | Owner |
|---------|--------|
| CRM outreach `/crm/messages` | CRM (compatibility shell) |
| Notification inbox | Notification Foundation |
| Match / referee / TT realtime | Competition / Referee / Team Tournament |
| Messaging UI `/messages` | Communication Experience (COMMS-06) |

See COMMS-00 for ownership, dependency status, and phase readiness.

## COMMS-06 snapshot

- Route `/messages` + menu **Tin nhắn** (group Giao tiếp) — distinct from CRM
- Three-column desktop shell; mobile list → thread → details drawer
- Tabs: Cá nhân / Câu lạc bộ / Cộng đồng / Yêu cầu trò chuyện
- Experience gateway port + `createDemoMessagingExperienceGateway` (not production)
- Text-only message rendering; attachment upload deferred
- Realtime = in-process signal → reload (no remote publication)

## COMMS-05 snapshot

- SQL package: `docs/supabase-communication-comms05.sql` (`AUTHORED_NOT_APPLIED`)
- Fail-closed client RLS (deny-all); trusted-backend adapters
- Realtime foundation via `RealtimeDeliveryPort` (no remote publication)
- Activation gates: Staging apply, Production, client RLS, realtime publication, Notification outbox

**Next:** COMMS-07 — production gateway wiring after COMMS-05 Staging activation (Owner GO).
