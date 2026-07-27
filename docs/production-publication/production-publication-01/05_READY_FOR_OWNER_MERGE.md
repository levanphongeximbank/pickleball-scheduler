# PRODUCTION-PUBLICATION-01 — Ready for Owner Merge

**Verdict:** `PRODUCTION_PUBLICATION_01_READY_FOR_OWNER_MERGE`  
**Branch:** `feature/production-publication-01-clubs-courts`  
**Timestamp UTC:** `2026-07-27T00:45:00.000Z`

## Completed

1. Applied Production catalog SQL/RLS (`public_catalog_01_public_read_rpc`).
2. Published CLB ACCC + Sân 3–6 public projections.
3. Owner set `VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote` and redeployed.
4. Verified Production anon RPC returns ACCC + 4 courts; fail-closed; direct table denied.
5. Verified Production bundle bakes `remote` against `expuvcohlcjzvrrauvud`.
6. Tests: targeted 101, full unit 6696, lint:no-new, foundation-lock, build — all PASS.

## Not mutated

- Unrelated clubs/courts
- `club_data_v3` inventory (MD5 unchanged through DB phase)
- Venue / cluster
- Tournaments / Rankings / Home
- Staging

## Owner next step

Review PR → merge when satisfied. Agent stops before merge.
