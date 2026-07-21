# 02 — Source-of-Truth Boundaries (CRM)

**Phase:** 1A (captured) / 1B (enforced in contracts)  
**Status:** Official

---

## Principle

Each concern has **one owner**. CRM may **reference** external IDs. CRM must not redefine person identity, membership, money, or notification delivery as a second source of truth.

---

## Ownership matrix

| # | Concern | Owner module | CRM role |
|---|---------|--------------|----------|
| 1 | Identity & Auth | `identity` / Auth | Reference `authUserId` only |
| 2 | User Profile | Identity `profiles` | Do not duplicate |
| 3 | Player identity / profile | `features/player` | Optional `playerId` reference |
| 4 | Venue customer records | Venue & Court (`customer.js`, court UI, club blob) | `customerId` on ContactReference only |
| 5 | Club memberships | Club / `club_members` | Do not redefine |
| 6 | Venue configuration | Venue / court | Scope context (`tenantId`, `venueId`) |
| 7 | Finance transactions / balances | Finance modules | Reference only; never own money |
| 8 | Notification delivery / inbox | `features/notifications` | Emit via port; do not own delivery |
| 9 | **CRM** | `features/crm` | Lead, opportunity, pipeline, interaction, task, tags, campaign orchestration, consent contracts, CRM audit |
| 10 | Reporting | Reporting projections | Consume CRM read models |

---

## CRM may own

- Lead lifecycle, source, assignment
- Opportunity and pipeline concepts
- Interaction timeline, CRM notes
- Tasks and follow-ups
- CRM relationship ownership
- CRM tags
- Campaign membership and orchestration
- Communication consent contracts
- CRM audit and integration event contracts

## CRM must not own

- Authentication users / user profiles
- Player identity or player profiles
- Venue customer records
- Club memberships
- Venue configuration
- Finance transactions or balances
- Notification delivery or inbox state

---

## Display snapshots

A limited `displaySnapshot` on ContactReference may capture display name/phone for audit/history. It must be marked **non-authoritative** (`authoritative: false`) and must never replace Venue/Player SoT.

---

## Hard rules

1. External IDs are optional typed references — do not copy full external profiles.
2. Every CRM aggregate requires explicit `tenantId` + `venueId`.
3. No silent default scope; no `demo-club` in new CRM code.
4. `customer.view` is **not** the canonical permission for CRM mutations (`crm.*` namespace).
