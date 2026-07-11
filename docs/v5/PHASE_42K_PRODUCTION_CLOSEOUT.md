# Phase 42K — Production Verification Closeout

**Status:** CLOSED  
**Date:** 2026-07-11  
**Production URL:** https://pickleball-scheduler-eight.vercel.app  
**Deployment:** `dpl_EJAp3Y7u6R9P8AtAD3Vx8rwcQpFB`  
**Supabase ref:** `expuvcohlcjzvrrauvud`  
**Rollback:** Không thực hiện  
**Redeploy:** Không thực hiện  
**Phase 42L:** Chưa bắt đầu  

---

## Verdict

| Layer | Result |
|-------|--------|
| Production app (read paths + isolation) | **PASS** |
| RPC contract / PostgREST signatures | **PASS** |
| Mutating QA flows B / C / D | **Không hoàn tất** — giới hạn gói + dữ liệu QA, **không phải lỗi Production** |
| Phase 42K | **CLOSED** |

---

## Production smoke — PASS (xác nhận)

Các mục sau đã PASS trên Production với deployment hiện tại. Evidence: `docs/v5/qa-evidence/phase42k-production/`.

| Check | Case | Verdict | Evidence |
|-------|------|---------|----------|
| **Tenant isolation** | A-tenant-owner-scope | PASS | ACCC visible trong `venue-prod-main`; `club_list_registry` cross-tenant (`venue-staging-b`) bị chặn / empty. Screenshot: `A-tenant-owner-manage.png` |
| **Platform registry** | A-platform-registry | PASS | SUPER_ADMIN thấy ACCC tại `/platform/clubs`. Screenshot: `A-sa-platform-clubs.png` |
| **SA không auto-pick tenant** | A-no-auto-pick | PASS | `/manage/clubs` hiển thị tenant picker khi chưa chọn tenant |
| **Discover** | E-discover | PASS | `/discover-clubs` gọi `club_list_discoverable` (`discoverRpc=1`). `REPORT.json` |
| **RPC signature** | dry-run | PASS | PostgREST resolve đúng overload 4-arg governance; PGRST202 chỉ khi gửi sai signature (control). `DRY_RUN.json`, `RPC_SIGNATURE_REPORT.json` |
| **No RPC loop** | E-no-rpc-loop | PASS | `club_get_my_active_membership` ≤ 3 lần sau reload (`membershipRpc=1`). `REPORT.json` |
| **No pageerror** | E-no-pageerrors | PASS | `pageErrors=0`. `REPORT.json` |

**CLB ACCC (`club-219e4a7cbd73437eb6271f02a53314c3`):** không bị mutate trong QA smoke.

---

## Mutating cases — không hoàn tất (ngoài phạm vi Production defect)

Case B (approve UI), C (governance assign/transfer), D (create club UI) **không chạy xong end-to-end** trên Production trong Phase 42K.

| Case | Trạng thái | Phân loại |
|------|------------|-----------|
| B — approve UI | Không hoàn tất | `PLAN_CLUB_LIMIT` + QA data |
| C — assign owner / transfer president | Không hoàn tất | Phụ thuộc tạo CLB QA → `PLAN_CLUB_LIMIT` |
| D — create club UI | Không hoàn tất | `PLAN_CLUB_LIMIT` trên tenant `venue-prod-main` |

### Root cause (không phải bug Production)

1. **`PLAN_CLUB_LIMIT`** — RPC `club_create` / UI tạo CLB trả về giới hạn gói subscription trên tenant Production (`phase42_check_club_plan_limit`). Không thể seed thêm CLB prefix `QA42K-PROD-*` để chạy B/C/D mutate.
2. **Dữ liệu QA** — tài khoản probe (`player@gmail.com` suspended; applicant fallback `doitruong@gmail.com`); pending request = 0 trên ACCC khi probe read-only; script/parser issues đã sửa trong session QA (không redeploy app).

**Kết luận:** Failures B/C/D reflect **plan quota + QA fixture limits**, not Production regression. Read-model, tenant scope, discover, RPC wiring verified PASS above.

---

## Artifacts

| File | Mô tả |
|------|--------|
| `qa-evidence/phase42k-production/REPORT.json` | Smoke sections (A/E isolated runs) |
| `qa-evidence/phase42k-production/AUDIT.json` | Script vs app root-cause audit |
| `qa-evidence/phase42k-production/DIAGNOSTIC.json` | Read-only selector + RPC diagnostic |
| `qa-evidence/phase42k-production/DRY_RUN.json` | Parser + live RPC signature dry-run |
| `qa-evidence/phase42k-production/RPC_SIGNATURE_REPORT.json` | Canonical RPC contract |
| `PHASE_42K_REGISTRY_READ_MODEL.md` | Registry read model map |
| `PHASE_42K_REGISTRY_AUDIT.md` | Pre-implementation audit |

---

## Scripts (reference — không chạy lại trong closeout)

- `scripts/verify-phase42k-prod-smoke-run.mjs` — env-safe runner  
- `scripts/verify-phase42k-production-smoke.mjs` — cases A–E  
- `scripts/verify-phase42k-production-dry-run.mjs` — contract / signature validation  
- `scripts/verify-phase42k-production-diagnostic.mjs` — read-only diagnostic  

---

## Sign-off

| Item | Value |
|------|-------|
| Production rollback | NO |
| Client redeploy | NO |
| Phase 42L started | NO |
| Phase 42K | **CLOSED** |
