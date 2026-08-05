# CUTOVER-02 — Writer Inventory & Freeze Matrix

Code: `src/features/player-rating/cutover-02/writer-freeze/writerInventory.js`

## Modes

| Mode | Behavior | Production default |
|------|----------|--------------------|
| `OFF` | Current behavior; no record/block | **Required** |
| `OBSERVE` | Record attempts; do not block | Forbidden without deny guard (forced OFF) |
| `ENFORCE` | Block staging freeze targets only | Forbidden (forced OFF) |

Flag: `VITE_RATING_V5_WRITER_FREEZE_MODE`

## Freeze targets (Staging ENFORCE)

- `PICK_VN_SYNC_RATING_RPC` (`pick_vn_sync_rating`) — **HIGH direct RPC bypass risk**
- `V2_ASSESSMENT_PUBLISH`
- `BLOB_SKILL_MIRROR`
- `LEGACY_ELO_PUBLIC_MIRROR`
- `ADMIN_MANUAL_OVERRIDE`
- `IMPORT_BACKFILL`

## Must remain allowed under ENFORCE

- V5 start / persist / invalidate / enrollment (shadow)
- CC-02 Competition Elo (not published skill)
- Unrelated profile/identity writes
- Local V2 cache (non-authority)

## Direct RPC bypass status

| Item | Status |
|------|--------|
| Client guard on `rpcPickVnSyncRating` | Implemented (default OFF) |
| DB-side guard SQL | **Authored** at `sql/RATING_V5_CUTOVER_02_STAGING_WRITER_FREEZE_GUARD.sql` |
| SQL applied | **NO** (`SQL_EXECUTION=0`) |
| Bypass residual | **BLOCKER for Staging ENFORCE rehearsal** until SQL applied after Owner GO-STAGING |

Client UI/flag alone is **not** sufficient protection when authenticated clients can call `pick_vn_sync_rating` directly.
