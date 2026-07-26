# PUBLIC-CATALOG-01S — Staging SQL/RLS Activation Readiness

## Owner authorization

- `STAGING_GO=YES`
- `PRODUCTION_GO=NO`

## Staging target (canonical)

| Field | Value |
|-------|-------|
| Environment | staging |
| Project ref | `qyewbxjsiiyufanzcjcq` |
| Host | `qyewbxjsiiyufanzcjcq.supabase.co` |
| MCP | `.cursor/mcp.json` → `supabase-staging` |
| Production blocklist | `expuvcohlcjzvrrauvud` (not touched) |

## Packages

| Artifact | Path | SHA256 (LF) |
|----------|------|-------------|
| Apply SQL | `docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql` | `2a90477990a883ad971ccbb0278f5b5cfa4edf03ea3866c07ccfb6676ee4a1ac` |
| Staging rollback | `docs/public-catalog/pc-01/11_PUBLIC_CATALOG_01_STAGING_ROLLBACK.sql` | `6c93225ad4cd4137a66960ef8f93877377d62c1eb4522791d1c85d3c13615573` |

## Readiness status (post Staging PASS)

```
CLUBS_STAGING_RPC=ACTIVE_VERIFIED
COURTS_STAGING_RPC=ACTIVE_VERIFIED
ANON_RPC_ACCESS=VERIFIED
DIRECT_TABLE_ACCESS=DENIED
ANON_MUTATION=DENIED
PRIVACY_BOUNDARY=VERIFIED
STAGING_SQL_RLS_APPLIED=YES
PRODUCTION_SQL_RLS_APPLIED=NO
PUBLIC_PORTAL_LIVE_CUTOVER=NO
PRODUCTION_RUNTIME_READINESS=NOT_ACHIEVED
```

## Dataset note

Staging currently has **zero** publicly listed clubs and **zero** projection court rows. Empty RPC success is a valid PASS under deny-by-default. No business seed was created for cosmetics.

## Rollback

Do **not** run rollback while activation verification is PASS. Procedure: apply `11_PUBLIC_CATALOG_01_STAGING_ROLLBACK.sql` on Staging only if an unsafe state is confirmed.

## Non-goals

- Production SQL apply
- Public Portal / EC-06 live cutover
- Competition Engine / Rankings changes
