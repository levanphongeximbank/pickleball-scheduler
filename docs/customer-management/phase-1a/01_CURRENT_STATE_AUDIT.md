# 01 — Current State Audit (CUSTOMER-01)

**Mode:** Read-only on fresh `origin/main`  
**Baseline:** `97ed6f8b`

## Customer-like representations found (~12)

| # | Representation | Classification | Notes |
|---|----------------|----------------|-------|
| 1 | `src/models/customer.js` | Legacy operational | Venue customer shape; types `walk_in\|member\|club\|visitor` |
| 2 | Club blob `customers[]` via `clubStorage` | Legacy SoT (ops) | Persisted in `club_data_v3` |
| 3 | `src/domain/customerService.js` | Legacy service | Mint `customer-${Date.now()}`; phone duplicate checks |
| 4 | Booking denormalized name/phone | Legacy coupling | No `customerId` FK |
| 5 | `customer-groups` feature | UI-local stub | Opaque member ids in localStorage |
| 6 | CRM `ContactReference.customerId` | Module reference | Not Customer SoT |
| 7 | CRM Lead/Opportunity/Interaction/Consent | CRM-owned | Person via ContactReference |
| 8 | Identity role `CUSTOMER` | Identity RBAC | Not a customer record |
| 9 | Auth / Profile user | Identity | Account only |
| 10 | Player profile | Player-owned | Athlete person |
| 11 | Club member | Club-owned | Membership edge |
| 12 | Finance `EXTERNAL_REFERENCE_KIND.CUSTOMER` | Finance reference | Opaque id |

Overlays: finance-ledger free-text customer, notification recipients (userId), competition guests, dashboard mocks.

## Canonical candidates

- **No foundation-level canonical `customerId` existed** before CUSTOMER-01.
- Best seed for migration later: venue blob customer `id`, treated as **legacy alias**, not auto-promoted.

## Collisions / drift

- Identity role name `CUSTOMER` vs customer master record
- Venue `customerType=member` vs Club `clubMember`
- CRM default subject `CRM_CUSTOMER` vs Customer-owned `CUSTOMER`
- Permissions `customer.*` (venue) vs `crm.*`

## Dependency findings

- CRM already defines `VenueCustomerDirectoryPort` expecting a Customer owner
- Finance already references `CUSTOMER` external kind
- Direct imports of `domain/customerService` / `clubStorage` from court UI remain legacy (untouched in CUSTOMER-01)

## Breaking-change risks (deferred)

Reminting ids, blob sync cutover, booking name/phone identity, equating role CUSTOMER with master data.
