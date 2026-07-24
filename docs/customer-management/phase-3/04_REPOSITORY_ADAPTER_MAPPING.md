# 04 — Repository Adapter Mapping

## Port

Unchanged `CustomerRepository` (CUSTOMER-01): `getById`, `findByCustomerNumber`, `search`, `list`, `save`, `exists`, `findDuplicate`.

## Durable factory

`createDurableCustomerRepository({ db })` where `db` is `CustomerDatabaseClientPort`.

## Mapping

| Domain | Persistence |
|--------|-------------|
| camelCase aggregate | snake_case rows |
| `contactPoints[]` | `customer_contact_points` |
| `addresses[]` | `customer_addresses` |
| `accountLinkage.userAccountId` | `account_user_id` |
| `playerLinkage.playerId` | `player_id` |
| `organizationLinkage.organizationId` | `organization_id` |
| overlay arrays | jsonb columns |

`save` → RPC `customer_save_aggregate(p_customer, p_contact_points, p_addresses)`.

Reads assemble root + children; return copy-safe frozen domain objects.

## Error mapping

| DB signal | CustomerError |
|-----------|---------------|
| `CUSTOMER_VERSION_CONFLICT` | `CUSTOMER_VERSION_CONFLICT` |
| unique `23505` | `CUSTOMER_DUPLICATE` |
| check/scope `23514` | `CUSTOMER_TENANT_SCOPE_MISMATCH` |
| permission `42501` | `CUSTOMER_TENANT_SCOPE_MISMATCH` |

No Supabase-specific types leak into domain or port.
