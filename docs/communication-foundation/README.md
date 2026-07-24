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
| **COMMS-06** Messaging Experience | Complete (UI + demo gateway) | [`comms-06/06_MESSAGING_EXPERIENCE.md`](./comms-06/06_MESSAGING_EXPERIENCE.md) |
| **COMMS-07** Integration Hardening & Final Certification | Complete (structure) · activation blocked | [`comms-07/07_INTEGRATION_FINAL_CERTIFICATION.md`](./comms-07/07_INTEGRATION_FINAL_CERTIFICATION.md) |

**Runtime module:** `src/features/communication/` — contracts, domain, ports, Direct + Club + Community application, persistence adapters + realtime foundation, Messaging Experience UI, **COMMS-07 runtime/provider/production gateway**.

## Final status (post COMMS-07)

| Surface | Status |
|---------|--------|
| **Structure** | COMPLETE |
| **Local/demo** | READY |
| **Remote persistence** | NOT ACTIVATED |
| **Client RLS** | FAIL-CLOSED |
| **Realtime** | NOT ENABLED |
| **Production** | BLOCKED |

## Hard boundary

Communication Foundation owns **conversations and messages**.
It does **not** own Identity, Player profile, Club membership, Notification delivery, Competition runtime, generic Storage, tenant lifecycle, or global audit persistence.

## Adjacent (not Communication)

| Concern | Owner |
|---------|--------|
| CRM outreach `/crm/messages` | CRM (compatibility shell) |
| Notification inbox | Notification Foundation |
| Match / referee / TT realtime | Competition / Referee / Team Tournament |
| Messaging UI `/messages` | Communication Experience (COMMS-06/07) |

See COMMS-00 for ownership, dependency status, and phase readiness.

## COMMS-07 snapshot

- Runtime modes: `DEMO` | `PRODUCTION` | `UNAVAILABLE` (fail-closed; no Production demo fallback)
- `CommunicationRuntimeProvider` mounted in `MainLayout` beside Notification runtime
- Production experience gateway via dependency injection (no Supabase singleton)
- `/messages` + menu **Tin nhắn** honor runtime mode
- Staging activation runbook authored, **not executed**: [`comms-07/07_STAGING_ACTIVATION_RUNBOOK.md`](./comms-07/07_STAGING_ACTIVATION_RUNBOOK.md)

## COMMS-06 snapshot

- Route `/messages` + menu **Tin nhắn** (group Giao tiếp) — distinct from CRM
- Three-column desktop shell; mobile list → thread → details drawer
- Tabs: Cá nhân / Câu lạc bộ / Cộng đồng / Yêu cầu trò chuyện
- Experience gateway port + demo gateway (local DX only)
- Text-only message rendering; attachment upload deferred
- Realtime = signal → reload (no remote publication)

## COMMS-05 snapshot

- SQL package: `docs/supabase-communication-comms05.sql` (`AUTHORED_NOT_APPLIED`)
- Fail-closed client RLS (deny-all); trusted-backend adapters
- Realtime foundation via `RealtimeDeliveryPort` (no remote publication)
- Activation gates: Staging apply, Production, client RLS, realtime publication, Notification outbox

**Next Owner action:** Staging activation only after Owner GO — follow COMMS-07 runbook.
