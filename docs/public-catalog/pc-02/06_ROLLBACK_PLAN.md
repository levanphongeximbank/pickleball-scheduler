# PUBLIC-CATALOG-02 — Rollback Plan

## Staging / Production SQL rollback

File: `docs/public-catalog/pc-02/90_PUBLIC_CATALOG_02_ROLLBACK.sql`  
SHA256 (LF): `6554428691536b00c480ea0c21eca5662b0ce1d756b9461a28d4fc6315990c72`

Drops **only**:

- `public.public_catalog_list_rankings(...)`
- `public.public_catalog_list_tournaments(...)`
- `public.public_catalog_rankings`
- `public.public_catalog_tournaments`

Does **not** drop:

- PC-01 clubs/courts objects
- `vpr_leaderboard` / VPR RPCs
- `club_data_v3` / competition tables

## Synthetic evidence rollback (Staging — completed)

```sql
DELETE FROM public.public_catalog_tournaments WHERE id LIKE 'pc02-synthetic-%';
DELETE FROM public.public_catalog_rankings WHERE id LIKE 'pc02-synthetic-%';
```

Verified residue: tournament_rows=0, ranking_rows=0.

## Application rollback

- Default portal source remains `local`
- Remote adapters have no mock fallback; revert env / undeploy feature branch as needed
- No Production env change was made in this workstream
