# PUBLIC-CATALOG-02 — Staging Activation

## Target

| Field | Value |
|-------|-------|
| Environment | Staging |
| Project ref | `qyewbxjsiiyufanzcjcq` |
| MCP | `project-0-pickleball-scheduler-supabase-staging` |
| Production blocklist | `expuvcohlcjzvrrauvud` |

## Package

| File | SHA256 (LF) |
|------|-------------|
| `docs/public-catalog/pc-02/10_PUBLIC_CATALOG_02_PUBLIC_READ_RPC.sql` | `29e072039015faf11caf33efddb2a82b21293357ee77b4c0d41ed0c9ffc2a5ba` |
| `docs/public-catalog/pc-02/90_PUBLIC_CATALOG_02_ROLLBACK.sql` | `6554428691536b00c480ea0c21eca5662b0ce1d756b9461a28d4fc6315990c72` |

## Apply

- Migration name: `public_catalog_02_public_read_rpc`
- Result: SUCCESS
- Production verified untouched after apply (PC-02 objects still absent; 4 published courts intact)

## Verification (PASS)

- SECURITY DEFINER on both RPCs
- RLS enabled; no permissive policies
- anon EXECUTE granted; anon table SELECT/INSERT denied
- Empty path: both RPCs return 0 rows → LIVE + EMPTY
- Controlled synthetic seed (2 tournament + 2 ranking rows, marked synthetic IDs)
- Positive path: published rows returned; unpublished excluded
- Fail-closed: limit>50 → `INVALID_PAGINATION`; invalid sort → `INVALID_SORT`
- Synthetic deleted; residue = 0; empty path re-verified

## Residue

Final Staging dataset for PC-02 projections: **0 rows** (schema/RPC retained).
