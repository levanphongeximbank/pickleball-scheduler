# 03 — Canonical Customer ID Contract

## Official decision

| Item | Contract |
|------|----------|
| Canonical key | `customerId` |
| Type | non-empty opaque `string` |
| Preferred mint prefix | `cust_` |
| Human code | `customerNumber` with prefix `CUS-` |
| Scope | `{ tenantId, venueId }` |
| Cardinality intent | One master customer record per scoped person/org |

## Minting (foundation)

- Injectable `CustomerIdGenerator` for tests/determinism
- Default memory generator: sequential prefix + entropy
- Production uniqueness guarantees deferred to persistence phase

## Legacy aliases (not canonical)

| Identifier | Classification |
|------------|----------------|
| `customer-${timestamp}` from `customerService` | Legacy venue ops id |
| Booking name/phone match | Soft identity — not an id |
| CRM `ContactReference.customerId` | Opaque reference to canonical (or legacy) id |
| Finance external CUSTOMER id | Opaque reference |
| Identity role `CUSTOMER` | Not an id |

## Linking rules

- Link account / player / organization stores **opaque foreign ids only**
- Linking a second different id while one exists → `CUSTOMER_LINKAGE_CONFLICT`
- Unlink sets linkage to `null`
- Never embed Player/User/Org aggregates inside Customer

## Merge / dedupe

Foundation exposes `createCustomerMergeProposal` + match kind codes. Runtime merge engine is **out of scope** for CUSTOMER-01.
