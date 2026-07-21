# CRM Architecture (Phase 1B + Phase 1C)

**Module home:** `src/features/crm/`
**Status:** Foundation contracts + ContactReference/Lead application services (not Production-ready CRM)
**Baseline:** Phase 1A audit (2026-07-21), Phase 1B contracts, owner-approved Phase 1C

---

## Purpose

CRM owns **relationship lifecycle and sales-operation concepts** for PICK_VN venues:

- Lead lifecycle, source, assignment
- Opportunity and pipeline concepts
- Interaction timeline, CRM notes, tasks/follow-ups
- Relationship ownership, tags
- Campaign **membership and orchestration** (not message delivery)
- Communication consent contracts (later)
- CRM audit and integration event contracts

CRM must **not** become the source of truth for auth users, user profiles, player identity/profiles, venue customers, club memberships, venue configuration, finance balances/transactions, or notification delivery/inbox.

---

## Layering

| Layer | Path | Role |
|-------|------|------|
| Constants | `constants/` | Permissions, statuses, error codes, event types |
| Models | `models/` | Pure normalize/validate helpers |
| Contracts | `contracts/` | Repository + cross-module ports (no Supabase) |
| Authorization | `authorization/` | Fail-closed actor + scope + permission |
| Repositories | `repositories/memory/` | In-memory proof implementations |
| Adapters | `adapters/` | Legacy LS compatibility boundary |
| Services | `services/` | Phase 1C application services + legacy LS (compat) |
| Testing | `testing/` | Test fakes only — not production facade |
| Projectors | `projectors/` | Read models |
| Pages | `pages/` | Legacy UI — not wired to new domain yet |
| Facade | `index.js` | Explicit public exports only |

---

## Phase 1C application services

`createLeadApplicationService(deps)` provides:

- `createContactReference`
- `createLead` (requires existing `contactRefId`)
- `getLead`
- `listLeads`
- `assignLead`

**Consistency model (MODEL 1):** each mutating command performs one aggregate
write and returns validated `pendingApplicationEvents` (`delivery: "pending"`).
No active audit/integration port dispatch in Phase 1C. No multi-write
compensating rollback in application services.

`PlayerDirectoryPort.getById(scope, playerId)` requires explicit tenant+venue scope
(same discipline as `VenueCustomerDirectoryPort`).

See `docs/crm/phase-1c/`.

---

## Scope rules

Every CRM aggregate and command requires:

- `tenantId` (mandatory, non-empty)
- `venueId` (mandatory, non-empty)

No silent defaults. No `demo-club` fallback in new CRM code.

---

## Source-of-truth matrix (summary)

| Concern | Owner | CRM |
|---------|-------|-----|
| Auth / profiles | Identity | reference `authUserId` only |
| Player | Player Management | reference `playerId` only |
| Venue customer | Venue & Court | reference `customerId` only |
| Club membership | Club | do not redefine |
| Finance | Finance | do not own money |
| Notification delivery | Notifications | emit via `NotificationEmitPort` |
| Lead / opportunity / interaction / task / CRM tag | **CRM** | owns |

See `docs/crm/phase-1a/02_SOURCE_OF_TRUTH_BOUNDARIES.md`.

---

## Compatibility

Existing localStorage messaging/campaign/history services and pages remain operational as **compatibility surfaces**. They are **not** canonical CRM repositories.

See `COMPATIBILITY.md`.

---

## Non-goals (Phase 1C)

- SQL / RLS / Supabase repositories
- Wiring new domain into existing CRM pages
- Complete lead lifecycle / opportunity conversion
- Identity SQL permission seeding
- Production / Staging deploy

---

## Phase 1D entry

Proceed to Phase 1D when Phase 1C acceptance criteria pass and owner approves commit. Phase 1D focuses on Opportunity + pipeline stages on the same foundation.
