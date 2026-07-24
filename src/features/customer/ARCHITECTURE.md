# Customer Management Architecture (CUSTOMER-01 … CUSTOMER-04)

**Module home:** `src/features/customer/`

**Status:** Domain + application services + in-memory repository + durable persistence adapter + runtime composition + Platform Core adoption + CRM directory adapter + consent/preference capability + Notification/CRM consent read adapters. SQL/RLS authored (not applied). UI deferred.

**Baseline:** CUSTOMER-01 (PR #211) + CUSTOMER-02 (PR #213) + CUSTOMER-03 (PR #216) + CUSTOMER-04 consent/preferences.

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
- communication preference + consent **business state**, history, and eligibility projection;
- typed linkages to user account, player, and organization;
- search/read of customer master data;
- merge/deduplication **contract** (foundation; runtime deferred).

Customer contact information is business master data. It is **not** an authentication credential and does not prove ownership or verification without trusted external evidence.

> Customer persistence is durable business master data and must never silently fall back to an in-memory repository in Production.

> Customer Management stores consent and communication preference facts. It does not independently determine legal permission when Platform Governance policy input is required.

> Notification may consume communication eligibility but must not mutate Customer consent state directly.

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
| Message delivery / queue / providers | Notification |
| Venue booking engine fields (name/phone denorm) | Venue / Booking (legacy until adoption) |

---

## Layering

```
platform/        Platform Core projections (pure)
adapters/        Cross-module boundary adapters (CRM directory, Notification eligibility, CRM consent read)
application/     CustomerApplicationService + ConsentPreferenceApplicationService
projectors/      Summary / details / profile / contact / consent / preference / eligibility
runtime/         Composition (disabled / memory / durable)
persistence/     Database client port + durable adapters + mapping
repositories/    Ports + in-memory certification adapters
domain/          Pure factories, transitions, value objects, eligibility
constants/       Enums and allowlists
errors/          Typed CustomerError codes
index.js         Public facade only
```

---

## Scope model

Customer records are scoped by `{ tenantId, venueId }`, matching CRM `VenueCustomerDirectoryPort`.

SQL: `tenant_id` + `venue_id` on every Customer table. RLS uses CRM-style fail-closed equality to `user_venue_id()` until Identity publishes a distinct tenant helper.

---

## Persistence

| Asset | Path |
|-------|------|
| CUSTOMER-03 SQL pack | `docs/customer-management/phase-3/` |
| CUSTOMER-04 SQL pack | `docs/customer-management/phase-4/` |
| Durable adapters | `src/features/customer/persistence/` |
| Runtime | `src/features/customer/runtime/` |

Aggregate writes: `customer_save_aggregate` RPC (service_role execute only).  
Consent/preference writes: `customer_save_consent` / `customer_save_preference` (service_role; current-state + history).  
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
- CRM `crm_consent_records` — CRM workflow history on contactRef (not Customer SoT)
- Finance `EXTERNAL_REFERENCE_KIND.CUSTOMER` — opaque reference only
- Identity role `CUSTOMER` — RBAC role, not a customer record

Adoption/migration of legacy venue customers remains **deferred**.

---

## Deferred (CUSTOMER-05+)

- Staging/Production apply (Owner-gated)
- Legacy club-blob compatibility adapter wired into runtime
- Booking `customerId` FK adoption
- Authenticated write policies + permission seed
- UI / routes / preference center
- Merge execution engine
- Contact verification runtime (OTP / email verify)
- Live Notification delivery enablement

See `docs/customer-management/phase-4/`.
