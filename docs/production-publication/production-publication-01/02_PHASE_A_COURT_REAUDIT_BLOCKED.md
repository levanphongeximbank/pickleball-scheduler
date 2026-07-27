# PRODUCTION-PUBLICATION-01 — Court Re-audit Closure (Phase A)

**Verdict:** `PRODUCTION_PUBLICATION_01_BLOCKED_NO_SAFE_COURT_CANDIDATE`  
**Owner prior decision:** `PRODUCTION_PUBLICATION_01_OWNER_NO_GO_PENDING_REAL_COURT`  
**Mutations:** none (Production + Staging untouched)

## Why blocked

Canonical court inventory SSOT is `club_data_v3.data.courts[]` (Venue & Court facade). Production has:

- no `public.courts` table
- `club_data_v3` rows = **0**
- candidate cluster `court_count` = **0**
- no governance `registered_court_ids` for CLB ACCC

Therefore there is **zero** canonical individual court eligible for `public_catalog_courts` projection.

## Upstream workstream (single)

**`PRODUCTION-COURT-INVENTORY-01`** — Certify Canonical Production Court Inventory for CLB ACCC

Create/sync ≥1 real court into Club V3 inventory for the approved club/venue, then resume this publication workstream.

## Club status

CLB ACCC remains **conditionally accepted** — **no standalone Club mutation**.
