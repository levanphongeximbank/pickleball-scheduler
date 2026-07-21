# CRM Architecture (Phase 1B + Phase 1C + Phase 1D + Phase 1E)

**Module home:** `src/features/crm/`
**Status:** Foundation contracts + Lead + Opportunity/Pipeline + Interaction/Task application services (not Production-ready CRM)
**Baseline:** Phase 1A–1D complete; owner-approved Phase 1E

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
| Services | `services/` | Phase 1C–1E application services + legacy LS (compat) |
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

See `docs/crm/phase-1c/`.

---

## Phase 1D application services

`createOpportunityApplicationService(deps)` provides:

- `createPipeline` / `listPipelines`
- `createOpportunityFromLead` (Opportunity write only — Lead conversion deferred)
- `getOpportunity` / `listOpportunities`
- `assignOpportunity`
- `advanceOpportunityStage`
- `closeOpportunityWon` / `closeOpportunityLost`

**Consistency model (MODEL 1):** each mutating command performs one aggregate
write and returns validated `pendingApplicationEvents` (`delivery: "pending"`).
No active audit/integration port dispatch. No multi-write compensating rollback.
`estimatedValue` is non-authoritative CRM data — no Finance transactions.

See `docs/crm/phase-1d/`.

---

## Phase 1E application services

`createInteractionApplicationService(deps)` provides:

- `recordInteraction` (append-only)
- `getInteraction`
- `listInteractions` (deterministic timeline filters/order)

`createTaskApplicationService(deps)` provides:

- `createTask` / `scheduleFollowUp`
- `getTask` / `listTasks`
- `assignTask` / `rescheduleTask`
- `startTask` / `completeTask` / `cancelTask`

Follow-up scheduling creates **one Task** only. No automatic Interaction, Lead/Opportunity
mutation, Notification, Calendar, email/SMS, or Finance side effects.

See `docs/crm/phase-1e/`.

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

## Phase 1F foundation (implemented)

- **Tags:** tenant/venue-scoped `CrmTag` definitions + `TagAssignment` to ContactReference, Lead, Opportunity
- **Consent:** append-only `ConsentRecord` history with deterministic effective-state evaluation
- **Pending events:** memory-first dispatch queue (`enqueue` / `claim` / `acknowledge` / `fail` / `releaseExpiredClaims`)
- Application services: `createTagApplicationService`, `createConsentApplicationService`, `createPendingEventDispatchService`
- MODEL 1 preserved — mutating commands return validated pending audit envelopes; no provider delivery

## Non-goals (Phase 1F)

- SQL / RLS / Supabase repositories
- CRM UI / routes
- Durable external event broker / background workers
- Notification / email / SMS / Push delivery
- Production / Staging deploy

---

## Phase 1G entry

Proceed to Phase 1G when Phase 1F acceptance criteria pass and owner approves commit.
Phase 1G may wire pending-event dispatch to durable adapters and/or CRM UI surfaces.
