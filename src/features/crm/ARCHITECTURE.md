# CRM Architecture (Phase 1B)

**Module home:** `src/features/crm/`  
**Status:** Foundation contracts + skeleton (not Production-ready CRM)  
**Baseline:** Phase 1A audit (2026-07-21), owner-approved with conditions

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
| Services | `services/` | Foundation helpers + legacy LS (compat) |
| Projectors | `projectors/` | Read models |
| Pages | `pages/` | Legacy UI — not wired to new domain yet |
| Facade | `index.js` | Explicit public exports only |

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

## Non-goals (Phase 1B)

- SQL / RLS / Supabase repositories
- Wiring new domain into existing CRM pages
- Complete lead/opportunity/campaign lifecycles
- Identity SQL permission seeding
- Production deploy

---

## Phase 1C entry

Proceed to Phase 1C when Phase 1B acceptance criteria pass and owner approves commit. Phase 1C focuses on ContactReference + Lead application services on the foundation contracts.
