# Customer Management Architecture (CUSTOMER-01 + CUSTOMER-02 + CUSTOMER-03)

**Module home:** `src/features/customer/`

**Status:** Domain + application services + in-memory repository + durable persistence adapter + runtime composition + Platform Core adoption + CRM directory adapter. SQL/RLS authored (not applied). UI deferred.

**Baseline:** CUSTOMER-01 (PR #211) + CUSTOMER-02 (PR #213) + CUSTOMER-03 persistence/runtime.

---

## Purpose / Ownership

Customer Management is the **canonical source of truth for customer master data**.

It owns:

- canonical `customerId` and `customerNumber`;
- customer master profile (display/legal name, individual/organization profile, type, status, contacts, addresses);
- durable tables + RLS + aggregate save RPC (authored);
- optimistic concurrency at database/RPC boundary;
- runtime composition (disabled / memory / durable) with Production fail-closed;
- classification / segment **references**;
- communication preference + consent **state/references** (business contract);
- typed linkages to user account, player, and organization;
- search/read of customer master data;
- merge/deduplication **contract** (foundation; runtime deferred).

Customer contact information is business master data. It is **not** an authentication credential and does not prove ownership or verification without trusted external evidence.

> Customer persistence is durable business master data and must never silently fall back to an in-memory repository in Production.

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

---

## Layering

```
platform/        Platform Core projections (pure)
adapters/        Cross-module boundary adapters (CRM directory)
application/     CustomerApplicationService (fail-closed without repo)
projectors/      Summary / details / profile / contact read models
runtime/         Composition (disabled / memory / durable)
persistence/     Database client port + durable adapter + mapping
repositories/    Ports + in-memory certification adapter
domain/          Pure factories, transitions, value objects, normalization
constants/       Enums and allowlists
errors/          Typed CustomerError codes
index.js         Public facade only
```

---

## Scope model

Customer records are scoped by `{ tenantId, venueId }`, matching CRM `VenueCustomerDirectoryPort`.

SQL: `tenant_id` + `venue_id` on every Customer table. RLS uses CRM-style fail-closed equality to `user_venue_id()` until Identity publishes a distinct tenant helper.

---

## Persistence (CUSTOMER-03)

| Asset | Path |
|-------|------|
| SQL pack | `docs/customer-management/phase-3/` |
| Durable adapter | `src/features/customer/persistence/` |
| Runtime | `src/features/customer/runtime/` |

Aggregate writes: `customer_save_aggregate` RPC (service_role execute only).  
Authenticated JWT: SELECT policies only — writes blocked until Owner authorizes.

---

## Fail-closed runtime

- `createFailClosedCustomerApplication()` / service without repository → `CUSTOMER_RUNTIME_NOT_CONFIGURED`
- `createCustomerRuntime({ mode: 'durable' })` without `db`/`repository` → fail-closed
- Production + memory mode → rejected
- No silent demo / memory fallback in Production

---

## Legacy representations (not SoT)

- `src/models/customer.js` + club blob `customers[]` — venue operational legacy
- CRM `ContactReference.customerId` — opaque reference only
- Finance `EXTERNAL_REFERENCE_KIND.CUSTOMER` — opaque reference only
- Identity role `CUSTOMER` — RBAC role, not a customer record

Adoption/migration of legacy venue customers remains **deferred** (see phase-3 docs).

---

## Deferred (CUSTOMER-04+)

- Staging/Production apply (Owner-gated)
- Legacy club-blob compatibility adapter wired into runtime
- Booking `customerId` FK adoption
- Authenticated write policies + permission seed
- UI / routes
- Merge execution engine
- Contact verification runtime (OTP / email verify)

See `docs/customer-management/phase-3/`.
