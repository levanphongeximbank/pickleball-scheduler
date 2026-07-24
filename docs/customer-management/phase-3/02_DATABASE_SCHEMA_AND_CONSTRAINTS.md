# 02 — Database Schema And Constraints

## Tables

### `customers`

Primary key `customer_id`. Unique `(tenant_id, venue_id, customer_number)` and `(tenant_id, venue_id, customer_id)`.

Key columns: type/status enums, display/legal name, locale, profile jsonb, linkage ids, overlay jsonb arrays, `version`, timestamps.

Soft archive: `status = ARCHIVED` (no `archived_at` — matches domain + Finance/CRM conventions).

### `customer_contact_points`

FK `(tenant_id, venue_id, customer_id)` → `customers` **ON DELETE CASCADE**.

Partial unique indexes:

- active normalized value per customer: `(customer_id, contact_type, normalized_value) WHERE status = 'ACTIVE'`
- one primary ACTIVE email / phone per customer

**Not** globally unique across customers (CUSTOMER-03).

### `customer_addresses`

Same dual-scope FK. Partial unique: one primary ACTIVE address per customer.

## Timestamp / ID generation

- IDs: application-minted opaque text (`cust_…`, contact/address ids).
- Timestamps: application / injected clock ISO strings persisted as `timestamptz`.
- No `gen_random_uuid()` as primary strategy.

## Migration files (apply order)

1. `10_CUSTOMER_PHASE_3_TABLES.sql`
2. `20_CUSTOMER_PHASE_3_INDEXES.sql`
3. `30_CUSTOMER_PHASE_3_RLS.sql`
4. `40_CUSTOMER_PHASE_3_SAVE_RPC.sql`
5. `50_CUSTOMER_PHASE_3_GRANTS.sql`

Rollback: `90_CUSTOMER_PHASE_3_ROLLBACK.sql`  
Verification: `99_CUSTOMER_PHASE_3_VERIFICATION.sql`
