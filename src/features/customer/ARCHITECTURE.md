# Customer Management Architecture (CUSTOMER-01 Foundation)

**Module home:** `src/features/customer/`

**Status:** Domain + application services + in-memory repository + Platform Core adoption + CRM directory adapter (foundation only). Persistence / UI / SQL / runtime wiring deferred.

**Baseline:** CUSTOMER-01 read-only audit on `origin/main` (`97ed6f8b`).

---

## Purpose / Ownership

Customer Management is the **canonical source of truth for customer master data**.

It owns:

- canonical `customerId` and `customerNumber`;
- customer master profile (display/legal name, type, status, contacts);
- customer lifecycle status;
- contact points;
- classification / segment **references**;
- communication preference + consent **state/references** (business contract);
- typed linkages to user account, player, and organization;
- search/read of customer master data;
- merge/deduplication **contract** (foundation; runtime deferred).

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
projectors/      Summary / details read models
repositories/    Ports + in-memory certification adapter
domain/          Pure factories, transitions, value objects
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

Adoption/migration of legacy venue customers is **CUSTOMER-02+**.

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

## Deferred (CUSTOMER-02+)

- SQL schema / RLS / Supabase adapter
- Legacy club-blob compatibility adapter wired into runtime
- Booking `customerId` FK adoption
- UI / routes
- Merge execution engine
- Contact verification runtime
- Production/Staging activation
