# PUBLIC-CATALOG-01E — Staging Publication Evidence Readiness

## Owner authorization

- `STAGING_DATA_MUTATION_GO=YES`
- `PRODUCTION_GO=NO`
- `PUBLIC_PORTAL_CUTOVER_GO=NO`

## Staging target

- Project ref: `qyewbxjsiiyufanzcjcq`
- Production blocklist: `expuvcohlcjzvrrauvud`
- MCP: `supabase-staging` only

## Packages

| Artifact | Path | SHA256 (LF) |
|----------|------|-------------|
| Seed | `10_PC01E_STAGING_SEED.sql` | `82d2c451bd61d27604a3522a36d756465143a6d7bd74bed0ca410efa925ae1e1` |
| Rollback | `90_PC01E_STAGING_SEED_ROLLBACK.sql` | `5ecabe5c5c869add122745308cf8ac3d33648b402697ece56c46150fa0c3a642` |

## Readiness classification (post PASS)

```
CLUBS_PUBLICATION_PATH=STAGING_VERIFIED
COURTS_PUBLICATION_PATH=STAGING_VERIFIED
PUBLIC_DTO_ALLOWLIST=VERIFIED
PRIVATE_CONTROL_EXCLUSION=VERIFIED
STAGING_SEED_APPLIED=YES
STAGING_SEED_ROLLED_BACK=YES
STAGING_TEST_DATA_REMAINING=0
STAGING_RPC_STATUS=ACTIVE_VERIFIED
PRODUCTION_SQL_RLS_APPLIED=NO
PUBLIC_PORTAL_LIVE_CUTOVER=NO
PRODUCTION_RUNTIME_READINESS=NOT_ACHIEVED
```

## Evidence

See `docs/public-catalog/pc-01/staging-publication-evidence/evidence/`.

## Rollback procedure (Owner)

1. Open Staging SQL only (`qyewbxjsiiyufanzcjcq`).
2. Run `90_PC01E_STAGING_SEED_ROLLBACK.sql` if any `PICKVN_PC01E_*` rows remain.
3. Confirm counts return to baseline and RPC remain ACTIVE.

**Do not** apply seed/rollback to Production. **Do not** cut over Public Portal.
