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
| **COMMS-05** Persistence & Realtime | Authored + **Staging applied** (deny-all); Production not applied; realtime not enabled | [`comms-05/05_PERSISTENCE_AND_REALTIME.md`](./comms-05/05_PERSISTENCE_AND_REALTIME.md) |
| **COMMS-06** Messaging Experience | Complete (UI + demo gateway) | [`comms-06/06_MESSAGING_EXPERIENCE.md`](./comms-06/06_MESSAGING_EXPERIENCE.md) |
| **COMMS-07** Integration Hardening & Final Certification | Complete (structure) · Staging persistence GO; client RLS / realtime / Production blocked | [`comms-07/07_INTEGRATION_FINAL_CERTIFICATION.md`](./comms-07/07_INTEGRATION_FINAL_CERTIFICATION.md) |
| **COMMS-ACT-01** Staging Activation Readiness Gate | Readiness package complete · Owner GO + backup captured | [`activation/comms-act-01/01_STAGING_ACTIVATION_READINESS.md`](./activation/comms-act-01/01_STAGING_ACTIVATION_READINESS.md) |
| **COMMS-ACT-02** Staging Apply | **GO_STAGING_PERSISTENCE** (deny-all; no realtime; no client RLS open) | [`activation/comms-act-02/02_STAGING_APPLY_CERTIFICATION.md`](./activation/comms-act-02/02_STAGING_APPLY_CERTIFICATION.md) |

**Runtime module:** `src/features/communication/` — contracts, domain, ports, Direct + Club + Community application, persistence adapters + realtime foundation, Messaging Experience UI, **COMMS-07 runtime/provider/production gateway**, **COMMS-ACT-01 activation readiness modules/scripts**.

## Final status (post COMMS-ACT-02)

| Surface | Status |
|---------|--------|
| **Structure / code** | COMPLETE |
| **Local/demo** | READY |
| **COMMS-ACT-01 readiness** | COMPLETE (Owner GO + backup) |
| **COMMS-ACT-02 Staging apply** | `GO_STAGING_PERSISTENCE` |
| **Remote persistence (Staging)** | APPLIED (14 tables, deny-all RLS) |
| **Client RLS** | FAIL-CLOSED (not opened) |
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

## COMMS-ACT-02 snapshot

- Staging project `qyewbxjsiiyufanzcjcq`: COMMS-05 SQL applied via Owner SQL Editor (run count 1)
- Catalog verification: 14 tables, 14 RLS, 14 deny-all policies, 2 triggers, **0** realtime publication rows
- Anon PostgREST: 14/14 PRESENT_DENIED; RPCs denied; `OPEN_COUNT=0`
- Evidence: [`activation/comms-act-02/`](./activation/comms-act-02/)
- **Not done:** Club/Community client RLS open, realtime enable, Production apply

## COMMS-ACT-01 snapshot

- Staging target allowlist / Production blocklist encoded in activation modules
- Fail-closed preflight + post-apply verification scripts (refuse `--apply`; no remote mutation)
- Backup gate, RLS matrix, realtime matrix, Direct/Club/Community smoke + negative RLS packages
- Evidence templates under [`activation/comms-act-01/`](./activation/comms-act-01/)
- Owner GO + backup evidence: captured for ACT-02 (see Gate A)

## COMMS-07 snapshot

- Runtime modes: `DEMO` | `PRODUCTION` | `UNAVAILABLE` (fail-closed; no Production demo fallback)
- `CommunicationRuntimeProvider` mounted in `MainLayout` beside Notification runtime
- Production experience gateway via dependency injection (no Supabase singleton)
- `/messages` + menu **Tin nhắn** honor runtime mode
- Staging activation runbook: [`comms-07/07_STAGING_ACTIVATION_RUNBOOK.md`](./comms-07/07_STAGING_ACTIVATION_RUNBOOK.md) — persistence steps executed in COMMS-ACT-02
- Operational readiness package: [`activation/comms-act-01/`](./activation/comms-act-01/)
- Staging apply certification: [`activation/comms-act-02/`](./activation/comms-act-02/)

## COMMS-06 snapshot

- Route `/messages` + menu **Tin nhắn** (group Giao tiếp) — distinct from CRM
- Three-column desktop shell; mobile list → thread → details drawer
- Tabs: Cá nhân / Câu lạc bộ / Cộng đồng / Yêu cầu trò chuyện
- Experience gateway port + demo gateway (local DX only)
- Text-only message rendering; attachment upload deferred
- Realtime = signal → reload (no remote publication)

## COMMS-05 snapshot

- SQL package: `docs/supabase-communication-comms05.sql` — **Staging applied** (`GO_STAGING_PERSISTENCE`); Production still blocked
- Fail-closed client RLS (deny-all); trusted-backend adapters
- Realtime foundation via `RealtimeDeliveryPort` (no remote publication)
- Remaining gates: client RLS open, realtime publication, Notification outbox, Production

**Next Owner action:** Trusted-backend Staging smoke and/or separate GO for client RLS / realtime — do **not** touch Production.
