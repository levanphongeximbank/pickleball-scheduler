# PRODUCTION-COURT-INVENTORY-01 — Phase A Exact Plan

**Verdict:** `PRODUCTION_COURT_INVENTORY_01_AWAITING_OWNER_GO`  
**Branch:** `feature/production-court-inventory-01-clb-accc`  
**Mutations:** none (Production untouched)

## Owner facts locked

CLB ACCC thuê 4 sân: **Sân 3, Sân 4, Sân 5, Sân 6** — active, covered, plastic, thuộc club/venue/cluster đã xác nhận.

## Deterministic IDs

| Name | ID |
|------|-----|
| Sân 3 | `court-club-219e4a7cbd73437eb6271f02a53314c3-n3` |
| Sân 4 | `court-club-219e4a7cbd73437eb6271f02a53314c3-n4` |
| Sân 5 | `court-club-219e4a7cbd73437eb6271f02a53314c3-n5` |
| Sân 6 | `court-club-219e4a7cbd73437eb6271f02a53314c3-n6` |

## Mutation gate

Cần exact Owner message:

`GO PRODUCTION COURT INVENTORY MUTATION`

Sau GO: Phase B capture before snapshot → INSERT `club_data_v3` → verify → tests → PR → dừng trước merge.
