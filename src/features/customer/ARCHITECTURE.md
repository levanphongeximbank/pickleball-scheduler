# Customer Management Architecture (CUSTOMER-01 + CUSTOMER-02)

**Module home:** `src/features/customer/`

**Status:** Domain + application services + in-memory repository + Platform Core adoption + CRM directory adapter. Profile/contact model completed in CUSTOMER-02. Persistence / UI / SQL / runtime wiring deferred.

**Baseline:** CUSTOMER-01 on `origin/main` (PR #211) + CUSTOMER-02 profile/contact fast track.

---

## Purpose / Ownership

Customer Management is the **canonical source of truth for customer master data**.

It owns:

- canonical `customerId` and `customerNumber`;
- customer master profile (display/legal name, individual/organization profile, type, status, contacts, addresses);
- customer lifecycle status;
- contact points (EMAIL/PHONE) with normalization, primary-per-type, verification **state**, lifecycle status;
- classification / segment **references**;
- communication preference + consent **state/references** (business contract);
- typed linkages to user account, player, and organization;
- search/read of customer master data;
- merge/deduplication **contract** (foundation; runtime deferred).

Customer contact information is business master data. It is **not** an authentication credential and does not prove ownership or verification without trusted external evidence.

---

## Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Auth credentials, sessions, roles, permissions | Identity / Platform Core |
| Player sports profile, ratings, competition roles | Player Management |
| Leads, opportunities, campaigns, care workflows | CRM |
| Payments, invoices, balances, ledger | Finance |
| Club membership / governance | Club Management |
| Privacy / retention / consent governance rules | Platform Governance |
| Venue booking engine fields (name/phone denorm) | Venue / Booking (legacy until adoption) |

Customer Management **provides references** to those modules; it does not copy their aggregates.

---

## Layering

```
platform/        Platform Core projections (pure)
adapters/        Cross-module boundary adapters (CRM directory)
application/     CustomerApplicationService (fail-closed without repo)
projectors/      Summary / details / profile / contact read models
repositories/    Ports + in-memory certification adapter
domain/          Pure factories, transitions, value objects, normalization
constants/       Enums and allowlists
errors/          Typed CustomerError codes
index.js         Public facade only
```

---

## Scope model

Customer records are scoped by `{ tenantId, venueId }`, matching CRM `VenueCustomerDirectoryPort`.

---

## Fail-closed runtime

`createFailClosedCustomerApplication()` / `createCustomerApplicationService()` without a repository throw `CUSTOMER_RUNTIME_NOT_CONFIGURED`. No silent demo fallback.

---

## Legacy representations (not SoT)

- `src/models/customer.js` + `src/domain/customerService.js` + club blob `customers[]` — venue operational legacy.
- CRM `ContactReference.customerId` — opaque reference only.
- Finance `EXTERNAL_REFERENCE_KIND.CUSTOMER` — opaque reference only.
- Identity role `CUSTOMER` — RBAC role, not a customer record.
- `customer-groups` localStorage — UI stub.

Adoption/migration of legacy venue customers is **CUSTOMER-03+**.

---

## Dependency direction

```
CRM / Finance / UI  →  Customer Management  →  Platform Core contracts
Customer Management  ↛  CRM internals
Customer Management  ↛  Player internals
Customer Management  ↛  Finance internals
Customer Management  ↛  Notification runtime
```

Communication channel string values align with CRM consent channels / Notification EMAIL·SMS surfaces without importing those modules.

---

## Deferred (CUSTOMER-03+)

- SQL schema / RLS / Supabase adapter
- Legacy club-blob compatibility adapter wired into runtime
- Booking `customerId` FK adoption
- UI / routes
- Merge execution engine
- Contact verification runtime (OTP / email verify)
- Production/Staging activation

See `docs/customer-management/phase-2/00_CUSTOMER_02_PROFILE_CONTACT.md`.
