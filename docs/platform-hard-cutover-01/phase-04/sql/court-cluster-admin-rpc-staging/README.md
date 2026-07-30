# Court Cluster Admin RPC — Staging Deploy Package

**Target only:** Supabase Staging `qyewbxjsiiyufanzcjcq`  
**Production forbidden:** `expuvcohlcjzvrrauvud`  
**Owner GO required before apply.** This package is **not** auto-applied.

## Why

Operator Acceptance `A-COURT` failed on Staging with:

- `RPC_NOT_DEPLOYED`
- `Could not find the function public.court_admin_upsert_cluster(p_cluster) in the schema cache`

Read-only diagnosis (2026-07-30) proved the object is **absent** on Staging (not signature drift, not rename, not schema-cache stale). Canonical SQL already exists in `docs/v5/` and was applied on Production; Staging never received PHASE_33 / PHASE_36 / PHASE_37.

## Canonical court cluster writer (app)

| Layer | Path |
|-------|------|
| Acceptance runner | `operatorAcceptanceRunner.js` → `rpcAdminUpsertCluster` |
| Cloud service | `courtClusterCloudService.js` → `upsertClusterToCloud` |
| RPC client | `courtClaimRequestRpcService.js` → `client.rpc("court_admin_upsert_cluster", { p_cluster })` |
| SQL authority | `docs/v5/PHASE_36_COURT_CLUSTER_CLOUD_SYNC.sql` |

BM-FINAL-COURT-01 owns **court-engine runtime** durable stores (`court_engine_*`), not court-cluster inventory upsert. Cluster cloud upsert remains PHASE_36.

Expected signature:

```sql
public.court_admin_upsert_cluster(p_cluster json) RETURNS json
-- SECURITY DEFINER, GRANT EXECUTE TO authenticated
```

Payload keys accepted by SQL: `id`, `venue_id`|`venueId`, `name`, `slug`, `status`, `court_count`|`courtCount`, `address`, `google_maps_url`|`googleMapsUrl`.

Auth gate inside RPC: `can_review_court_claim()` = `is_super_admin() OR user_has_permission('cluster.manage')`.

## Apply order (Staging only, after Owner GO)

1. `10_PHASE_33_COURT_CLAIM_REQUESTS.sql` — creates `court_claim_requests`, `can_review_court_claim`, claim RPCs (dependency of PHASE_36).
2. `20_PHASE_36_COURT_CLUSTER_CLOUD_SYNC.sql` — creates `court_admin_upsert_cluster` / remove / delete.
3. `30_PHASE_37_CLUB_REGISTERABLE_CLUSTERS.sql` — creates `court_list_registerable_clusters` (A-COURT read-back).
4. Run `99_VERIFY.sql` (read-only). Expect all required objects present.

Do **not** invent alternate RPC names for the runner. Do **not** apply to Production via this package.

## Post-apply operator note

Re-run Operator Acceptance on Staging Preview after verify PASS. Actor must satisfy `can_review_court_claim()` (SUPER_ADMIN / `cluster.manage`).
