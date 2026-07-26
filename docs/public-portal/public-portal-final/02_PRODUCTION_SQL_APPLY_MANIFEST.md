# Production SQL Apply Manifest (authored — NOT applied)

**Package source:** `docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql`  
**Target project:** `expuvcohlcjzvrrauvud` only  
**Staging blocklist:** `qyewbxjsiiyufanzcjcq`  
**Status:** READY for Phase B only after GO + empty-catalog gate cleared  
**Phase A apply:** NO

## Apply order (Phase B)

1. Confirm MCP/CLI target host contains `expuvcohlcjzvrrauvud`.  
2. Confirm staging ref is **not** the active mutation target.  
3. Capture PRE_ROLLOUT_SNAPSHOT.  
4. `apply_migration` name: `public_catalog_01_public_read_rpc_production` with exact package SQL.  
5. Verify objects, grants, RLS, anon boundary, RPC results.  
6. Only then env cutover.

## Idempotency

- `ADD COLUMN IF NOT EXISTS`
- `CREATE TABLE IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION`
- `CREATE INDEX IF NOT EXISTS`
- Re-apply safe if interrupted before portal cutover.

## Migration collision

| Project | Latest migration | Catalog migration |
|---------|------------------|-------------------|
| Production | `20260717155720` / 59 rows | ABSENT |
| Staging | `20260726053052` / 141 rows | `public_catalog_01_public_read_rpc` |

No Production collision with catalog migration name/version.

## Data mutation

This package does **not** set `is_publicly_listed=true` and does **not** insert `public_catalog_courts` rows. Publication must exist before portal cutover.
